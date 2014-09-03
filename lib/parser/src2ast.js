// Parse SRC HTML (input format) to AST
//

'use strict';

var $     = require('./cheequery');
var _     = require('lodash');
var async = require('async');

var cleanupRules;
var smilesRules;
var medialinkProviders;


// Compile cleanup rules
//
function compileCleanupRules (cleanupRules) {
  var rules = _.cloneDeep(cleanupRules);
  var regExpParse = /^\/(.*?)\/(g?i?m?y?)$/;

  var groups = {};
  var all = Object.keys(rules);

  // Extract groups
  _.forEach(rules, function (rule, tag) {
    if (rule.group) {
      groups[rule.group] = groups[rule.group] || [];
      groups[rule.group].push(tag);
    }
  });

  _.forEach(rules, function (rule) {

    // Prepare attributes
    var attributes = {};

    if (_.isPlainObject(rule.attributes)) {
      var attrs = [];

      _.forEach(rule.attributes, function (val, attr) {
        var attrObj = {};

        attrObj[attr] = val;
        attrs.push(attrObj);
      });
      rule.attributes = attrs;
    }

    if (_.isString(rule.attributes)) {
      rule.attributes = [ rule.attributes ];
    }

    _.forEach(rule.attributes || [], function (val) {
      var attr;

      if (_.isObject(val)) {
        attr = Object.keys(val)[0];
        val = val[attr];
      } else {
        attr = val;
        val = '.*';
      }

      // If val is regexp
      if (val.length > 0 && val[0] === '/') {
        attributes[attr] = new RegExp(
          val.replace(regExpParse, '$1'),
          val.replace(regExpParse, '$2')
        );
        return;
      }

      // If val is enum
      if (_.isArray(val)) {
        val = val.join('|');
      }

      attributes[attr] = new RegExp('^' + val + '$');
    });

    rule.attributes = attributes;

    // Prepare children
    var children = [];

    rule.children = rule.children || [];
    rule.children = _.isArray(rule.children) ? rule.children : [ rule.children ];

    _.forEach(rule.children, function (val) {
      var add = true;

      if (val.length > 0 && val[0] === '!') {
        add = false;
        val = val.substr(1);
      }

      if (val === '*') {

        if (add) {
          children = _.union(children, all);
        } else {
          children = _.difference(children, all);
        }
        return;
      }

      if (val.length > 6 && val.substr(0, 6) === 'group-') {

        if (add) {
          children = _.union(children, groups[val.substr(6)] || []);
        } else {
          children = _.difference(children, groups[val.substr(6)] || []);
        }
        return;
      }

      if (all.indexOf(val) !== -1 || val === 'text') {

        if (add) {
          children = _.union(children, [ val ]);
        } else {
          children = _.difference(children, [ val ]);
        }
        return;
      }
    });

    rule.children = children;
  });

  return rules;
}


// Compile smiles rules
//
function compileSmilesRules(smilesConfig) {
  var smiles = _.cloneDeep(smilesConfig);

  // Compile regular expressions
  _.forEach(smiles, function (val, name) {
    if (!_.isArray(val)) {
      val = [ val ];
    }

    for (var i = 0; i < val.length; i++) {
      val[i] = val[i].replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    }

    smiles[name] = new RegExp('(' + val.join('|') + ')', 'g');
  });

  return smiles;
}


// Cleanup tag attributes
//
function cleanupAttrs($tag, tagName) {
  _.forEach($tag.attrs(), function (value, name) {
    var attrOptions = cleanupRules[tagName].attributes;

    if (!attrOptions[name] || !attrOptions[name].test(value)) {
      $tag.removeAttr(name);
    }
  });
}


// Cleanup disallowed tags
//
function cleanupTags(parent, tagOptions) {
  if (!tagOptions) {
    return;
  }

  var children = parent.contents();
  var length = children.length;

  for (var i = 0; i < length; i++) {

    var $tag = $(children[i]);
    var tagName = ($tag.prop('tagName') || 'text').toLowerCase();

    // Tag doesn't allowed
    if (tagOptions.children.indexOf(tagName) === -1) {

      if (tagName === 'text' && tagOptions.children.indexOf('p') !== -1) {
        $tag.after('<p>' + $tag.text() + '</p>');
      } else {
        $tag.after($tag.contents());
      }

      $tag.remove();

      i--;
      children = parent.contents();
      length = children.length;

      continue;
    }

    cleanupAttrs($tag, tagName);

    cleanupTags($tag, cleanupRules[tagName]);
  }
}


// Replace plain links to tags 'a'
//
function plainLinks2html(ast) {
  var urlRegExp = /(https?:\/\/[^\s'"\)\(<>$]+)/gim;

  var replaceLink = function ($tag) {

    // If text node already in tag 'a' skip it
    if ($tag.closest('a').length !== 0) {
      return;
    }

    var parts = $tag.text().split(urlRegExp);

    // Text node doesn't contains links
    if (parts.length === 1) {
      return;
    }

    for (var i = 0; i < parts.length; i++) {
      if (urlRegExp.test(parts[i])) {

        // Replace links
        $tag.before(_.template(
          '<a href="<%-link%>"><%-text%></a>',
          {
            link: parts[i],
            // For long links show first 30 symbols
            text: parts[i].length > 30 ? parts[i].substr(0, 30) + '...' : parts[i]
          }
        ));
      } else {

        // Append text parts
        $tag.before($.createTextNode(parts[i]));
      }
    }

    // Remove old text node
    $tag.remove();
  };

  // Find text nodes in root
  ast.textNodes().each(function () {
    replaceLink($(this));
  });

  // Find text nodes in nested elements
  ast.find('*').textNodes().each(function () {
    replaceLink($(this));
  });
}


// Replace smiles by html codes
//
function smiles2html(ast) {

  var replaceSmiles = function ($tag) {
    var text = $tag.text();
    var positions = [];
    var pos;

    // Search positions of every smile
    _.forEach(smilesRules, function (regExp, name) {
      while ((pos = regExp.exec(text)) !== null) {
        positions.push({ name: name, start: pos.index, end: regExp.lastIndex });
      }
    });

    var length = positions.length;

    // No smiles found
    if (length === 0) {
      return;
    }

    // Sort by position
    positions.sort(function (a, b) {
      return a.start - b.start;
    });

    var lastPos = 0;

    for (var i = 0; i < length; i++) {
      pos = positions[i];

      // Append text part before first smile
      $tag.before($.createTextNode(text.substr(lastPos, pos.start - lastPos)));

      // Append smile
      $tag.before(_.template(
        '<span data-nd-type="smile" data-nd-id="<%=id%>" data-nd-src="<%=src%>" class="smiles smile_<%=id%>"></span>',
        {
          id: pos.name,
          src: text.substr(pos.start, pos.end - pos.start)
        }
      ));

      lastPos = pos.end;

      // Append last text part (only for last position)
      if (i === length - 1) {
        $tag.before($.createTextNode(text.substr(pos.end, text.length - pos.end)));
      }
    }

    // Remove old text node
    $tag.remove();
  };

  // Find text nodes in root
  ast.textNodes().each(function () {
    replaceSmiles($(this));
  });

  // Find text nodes in nested elements
  ast.find('*').textNodes().each(function () {
    replaceSmiles($(this));
  });
}


// Replace medialinks by html codes
//
function medialinks2html(ast, callback) {

  var replace = [];

  ast.find('a').each(function() {
    var tag = $(this);

    _.forEach(medialinkProviders, function (provider) {
      for (var i = 0; i < provider.match.length; i++) {

        if (provider.match[i].test(tag.attr('href'))) {
          replace.push({ provider: provider, tag: tag });
          return false; // break forEach
        }
      }
    });
  });

  async.eachSeries(replace, function (item, next) {
    item.provider.fetch(item.tag.attr('href'), function (err, data) {
      if (err) {
        next(err);
        return;
      }

      item.tag.replaceWith(item.provider.template(data));
      next();
    });
  }, callback);
}

// Replace spoiler tag
//
function replaceSpoiler(ast) {
  ast.find('spoiler').each(function () {
    var $this = $(this);
    var $spoiler = $('<div>');
    var $spoilerTitle = $('<div class="spoiler-title">');
    var $spoilerContent = $('<div class="spoiler-content">');

    $spoilerTitle.text($this.attr('title'));

    $spoilerContent.append($this.contents());

    $spoiler
      .attr('data-nd-type', 'spoiler')
      .attr('data-nd-title', $this.attr('title'))
      .append($spoilerTitle)
      .append($spoilerContent);

    $this.replaceWith($spoiler);
  });
}


// Replace tags
//
var replaceTagsConfig = {
  i: 'em',
  b: 'strong',
  s: 'del'
};

function replaceTags(ast) {
  var $this, $replace;

  _.forEach(replaceTagsConfig, function (dest, src) {
    ast.find(src).each(function () {
      $this = $(this);
      $replace = $('<' + dest + '>');

      _.forEach($this.attrs(), function (value, name) {
        $replace.attr(name, value);
      });

      $replace.append($this.contents());

      $this.replaceWith($replace);
    });
  });
}


// Merge node with same node right of this
//
function mergeNextSibling($node) {
  var $sibling, siblingAttrs, nodeAttrs, attrsKeys;

  $sibling = $node.nextNode();

  if (!$sibling) {
    return;
  }

  if ($sibling.prop('tagName') === $node.prop('tagName')) {

    // Check is text node
    if (!$node.prop('tagName')) {
      $node.replaceWith($.createTextNode($node.text() + $sibling.text()));
      $sibling.remove();
      return;
    }

    nodeAttrs = $node.attrs();
    siblingAttrs = $sibling.attrs();
    attrsKeys = Object.keys(nodeAttrs);

    // Can't merge nodes if attributes is not equal, check size of attributes
    if (attrsKeys.length !== Object.keys(siblingAttrs).length) {
      return;
    }

    // Check all attributes are equals
    for (var i = 0; i < attrsKeys.length; i++) {
      if (nodeAttrs[attrsKeys[i]] !== siblingAttrs[attrsKeys[i]]) {
        return;
      }
    }

    $node.append($sibling.contents());
    $sibling.remove();
  }
}


// Merge siblings text nodes
//
// $node - parent node
//
function normalizeTextChildren($node) {
  var textNodes = $node.textNodes();

  for (var i = 0; i < textNodes.length; i++) {
    mergeNextSibling($(textNodes[i]));
  }
}


// Get CSS selector for tags that can be merged from config
//
var mergeSiblingsSelector = _.memoize(function () {
  var tags = [];

  // Find tags marked as 'merge_same' in config
  _.forEach(cleanupRules, function(cfg, tag) {
    if (cfg.merge_same) {
      tags.push(tag);
    }
  });

  return tags.join(', ');
});


// Merge siblings
//
function mergeSiblings($node) {
  var $this, selector;

  selector = mergeSiblingsSelector();

  $node.children().each(function () {
    $this = $(this);

    if ($this.is(selector)) {
      mergeNextSibling($this);
      normalizeTextChildren($this.parent());
    }

    mergeSiblings($this);
  });
}


// Remove empty tags
//
function removeEmptyTags(ast) {
  var tags = [];
  var $this, $parent;

  // Find tags marked as 'remove_empty' in config
  _.forEach(cleanupRules, function(cfg, tag) {
    if (cfg.remove_empty) {
      tags.push(tag);
    }
  });

  ast.find(tags.join(', ')).each(function () {
    $this = $(this);

    if ($this.contents().length === 0) {
      $parent = $this.parent();
      $this.remove();
      normalizeTextChildren($parent);
    }
  });
}


module.exports = function (data, callback) {
  cleanupRules = compileCleanupRules(data.options.cleanupRules);
  smilesRules = compileSmilesRules(data.options.smiles);
  medialinkProviders = data.options.medialinkProviders;

  data.output = $.parse(data.input);

  replaceTags(data.output);
  removeEmptyTags(data.output);
  mergeSiblings(data.output);
  cleanupTags(data.output, cleanupRules.root);
  plainLinks2html(data.output);
  smiles2html(data.output);
  replaceSpoiler(data.output);
  medialinks2html(data.output, callback);
};
