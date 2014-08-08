'use strict';

var $     = require('./cheequery');
var _     = require('lodash');
var async = require('async');

var cleanupRules;
var smilesRules;
var medialinkProviders;


// Replace plain links to tags 'a'
//
function plainLinks2html(input) {
  return input.replace(/(^|\s+)(https?:\/\/[^\s$]+)/gim, '$1<a href="$2">$2</a>');
}


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


// Replace smiles by html codes
//
function smiles2html(text) {
  _.forEach(smilesRules, function (regExp, name) {
    text = text.replace(
      regExp,
      '<span data-nd-type="smile" data-nd-id="' + name + '" data-nd-src="$&" class="smiles smile_' + name + '"></span>'
    );
  });

  return text;
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


    if (tagName === 'text') {

      if ($tag.closest('a').length === 0) {

        // If text node is already in 'a' tag - don't replace links. Just replace smiles.
        $tag.replaceWith(plainLinks2html(smiles2html($tag.text())));
      } else {

        // Replace links and smiles to html code
        $tag.replaceWith(smiles2html($tag.text()));
      }
    } else {
      cleanupTags($tag, cleanupRules[tagName]);
    }
  }
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


module.exports = function (data, callback) {
  cleanupRules = compileCleanupRules(data.options.cleanupRules);
  smilesRules = compileSmilesRules(data.options.smiles);
  medialinkProviders = data.options.medialinkProviders;

  data.output = $.parse(data.input);

  cleanupTags(data.output, cleanupRules.root);
  medialinks2html(data.output, callback);
};
