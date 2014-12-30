// Parse SRC HTML (input format) to AST
//
// data:
// - input - SRC HTML (String)
// - output - AST with methods .html(), .text()
// - options:
//   - baseUrl - the URL or array of the URLs (example: [ 'nodeca.com', 'www.nodeca.com' ])
//   - cleanupRules - rules to cleanup HTML
//   - smiles - rules to parse smiles
//   - noMedialinks - disable medialinks
//
//

'use strict';

var $     = require('./cheequery');
var _     = require('lodash');
var async = require('async');

var cleanupRules;
var smilesRules;


module.exports = function (N) {


  // Compile cleanup rules
  //
  var compileCleanupRules = _.memoize(function(cleanupRules) {
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
  }, JSON.stringify);


  // Escape RegExp special characters
  // http://stackoverflow.com/questions/3115150
  //
  function escapeRegexp(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  }


  // Compile smiles rules
  //
  var compileSmilesRules = _.memoize(function(smilesConfig) {
    if (Object.keys(smilesConfig).length === 0) {
      return null;
    }

    var smiles = [], pattern;
    var result = {
      templates: {},
      matchRE: null
    };

    _.forEach(smilesConfig, function (val, name) {
      if (!_.isArray(val)) {
        val = [ val ];
      }

      for (var i = 0; i < val.length; i++) {

        smiles.push(val[i]);

        // Create replacement template for each smile
        result.templates[val[i]] = _.template(
          '<span data-nd-type="smile" data-nd-id="<%=id%>" data-nd-src="<%=src%>" class="smiles smile_<%=id%>"></span>',
          {
            id: name,
            src: val[i]
          }
        );
      }
    });

    // Compile regular expression to find all smiles
    pattern = smiles.map(function (smile) { return escapeRegexp(smile); }).join('|');

    result.matchRE = new RegExp('(' + pattern + ')', 'g');

    return result;
  }, JSON.stringify);


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
        $tag.remove();
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
      if (!smilesRules) {
        return;
      }

      var text = $tag.text();
      var positions = [];
      var pos;

      // Search positions of every smile
      while ((pos = smilesRules.matchRE.exec(text)) !== null) {
        positions.push({ smile: pos[1], start: pos.index, end: smilesRules.matchRE.lastIndex });
      }

      var length = positions.length;

      // No smiles found
      if (length === 0) {
        return;
      }

      var lastPos = 0;

      for (var i = 0; i < length; i++) {
        pos = positions[i];

        // Append text part before first smile
        $tag.before($.createTextNode(text.substr(lastPos, pos.start - lastPos)));

        // Append smile
        $tag.before(smilesRules.templates[pos.smile]);

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
    var medialinker = N.medialinker('content');

    async.eachSeries(ast.find('a'), function (item, next) {
      var tag = $(item);

      medialinker.render(tag.attr('href'), function (err, result) {
        if (err) {
          next(err);
          return;
        }

        if (!result) {
          next();
          return;
        }

        tag.replaceWith(result.html);
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


  // Get CSS selector for tags that can be removed
  //
  var createRemovalSelector = _.memoize(function () {
    var tags = [];

    // Find tags marked as 'remove_empty' in config
    _.forEach(cleanupRules, function(cfg, tag) {
      if (cfg.remove_empty) {
        tags.push(tag);
      }
    });

    return tags.join(', ');
  });


  // Remove empty tags
  //
  function removeEmptyTags(ast) {
    var $this, $parent;

    ast.find(createRemovalSelector()).each(function () {
      $this = $(this);

      if ($this.contents().length === 0) {
        $parent = $this.parent();
        $this.remove();
        normalizeTextChildren($parent);
      }
    });
  }


  // Cut 'http:', 'https:' from internal links, add 'target=_blank' to external links
  //
  function prepareLinks(ast, baseUrl) {
    if (!baseUrl) {
      return;
    }

    var $this, href;
    var url = _.isArray(baseUrl) ? baseUrl.join('|') : baseUrl;

    url = url.replace(/\./g, '\\.');

    var checkInternalRE = new RegExp('(^https?:\\/\\/' + url + ')|(^\\/)', 'i');
    var removeProtocolRE = /^https?:/;

    ast.find('a').each(function () {
      $this = $(this);
      href = $this.attr('href');

      // Check is URL internal
      if (checkInternalRE.test(href)) {

        // Cut 'http:', 'https:'
        $this.attr('href', href.replace(removeProtocolRE, ''));
      } else {

        // add 'target=_blank'
        $this.attr('target', '_blank');
      }
    });
  }


  // TODO: need rework
  // Add data-nd-* attributes to links to binary media
  //
  function addBinaryMediaAttrs(ast) {
    var $elem, match;

    ast.find('a').each(function () {
      $elem = $(this);

      match = _.find(N.router.matchAll($elem.attr('href')), function (match) {
        return match.meta.methods.get === 'users.media';
      });

      // It is not URL of media, continue
      if (!match) {
        return;
      }

      $elem
        .attr('data-nd-type', 'attach_bin')
        .attr('data-nd-media-id', match.params.media_id)
        .attr('data-nd-title', $elem.text());
    });
  }


  // TODO: need rework
  // Add data-nd-* attributes to image media
  //
  function addImageMediaAttrs(ast) {
    var $elem, match, size;

    ast.find('img').each(function () {
      $elem = $(this);

      match = _.find(N.router.matchAll($elem.attr('src')), function (match) {
        return match.meta.methods.get === 'users.media';
      });

      // It is not URL of media, continue
      if (!match) {
        return;
      }

      size = $elem.attr('size') || 'sm';

      $elem
        .attr('data-nd-type', 'attach_img')
        .attr('data-nd-media-id', match.params.media_id)
        .attr('data-nd-size', size)
        .attr('data-nd-align', $elem.attr('align') || 'left')
        .attr('data-nd-src', $elem.attr('src'))
        .attr('data-nd-title', $elem.attr('title') || '')
        // Replace url of page to url of file
        .attr('src', N.router.linkTo('core.gridfs', { bucket: match.params.media_id + '_' + size }));
    });
  }


  return function(data, callback) {
    cleanupRules = compileCleanupRules(data.options.cleanupRules);
    smilesRules = compileSmilesRules(data.options.smiles);

    data.output = $.parse(data.input);

    replaceTags(data.output);
    removeEmptyTags(data.output);
    mergeSiblings(data.output);
    cleanupTags(data.output, cleanupRules.root);
    plainLinks2html(data.output);
    prepareLinks(data.output, data.options.baseUrl);
    smiles2html(data.output);
    replaceSpoiler(data.output);
    addBinaryMediaAttrs(data.output);
    addImageMediaAttrs(data.output);

    if (data.options.noMedialinks) {
      callback();
      return;
    }

    medialinks2html(data.output, callback);
  };

};
