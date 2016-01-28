// Sanitize generated AST
//
'use strict';

var _ = require('lodash');
var $ = require('../cheequery');

module.exports = function (__, rules) {

  return function (parser) {

    var compiledRules = null;

    ///////////////////////////////////////////////////////////////////////////
    // Compile sanitizer config

    parser.bus.before('sanitize', function compile_sanitizer_config(data) {

      // If config already compiled - continue
      if (compiledRules) return;

      var regexpParse = /^\/(.*?)\/(g?i?m?y?)$/;

      compiledRules = {};

      // Merge config for plugins
      _.forEach(rules, function (pluginConfig, pluginName) {
        if (data.params.options[pluginName] !== false) {
          _.merge(compiledRules, pluginConfig);
        }
      });

      var groups = {};

      _.forEach(compiledRules, function (rule, tagName) {

        // Make groups list
        if (rule.group) {
          if (_.isArray(rule.group)) {
            rule.group.forEach(function (groupName) {
              groups[groupName] = groups[groupName] || {};
              groups[groupName][tagName] = true;
            });
          } else {
            groups[rule.group] = groups[rule.group] || {};
            groups[rule.group][tagName] = true;
          }
        }

        // If `attributes` is false - skip attributes check
        if (rule.attributes !== false) {
          rule.attributes = rule.attributes || {};
        }

        // Compile attributes
        _.forEach(rule.attributes, function (attrValue, attrName) {

          // If `attrValue` is regexp
          if (attrValue.length > 0 && attrValue[0] === '/') {
            rule.attributes[attrName] = new RegExp(
              attrValue.replace(regexpParse, '$1'),
              attrValue.replace(regexpParse, '$2')
            );
            return;
          }

          // If `attrValue` is enum
          if (_.isArray(attrValue)) {
            rule.attributes[attrName] = new RegExp('^' + attrValue.join('|') + '$');
            return;
          }

          // If `attrValue` is true
          if (attrValue === true) {
            rule.attributes[attrName] = new RegExp('^.*$');
            return;
          }

          // Anything else - remove attribute
          rule.attributes[attrName] = null;
        });
      });

      // Extract groups
      _.forEach(compiledRules, function (rule) {
        // If `children` is false - skip children tags check
        if (rule.children === false) {
          return;
        }

        rule.children = rule.children || {};

        _.forEach(rule.children, function (value, key) {
          if (key.indexOf('group_') === 0 && value === true) {
            _.defaults(rule.children, groups[key.replace('group_', '')]);
          }
        });
      });
    });


    ///////////////////////////////////////////////////////////////////////////
    // Sanitize disallowed tags

    function sanitizeChildren(parent, tagOptions) {
      _.forEach(parent.contents(), function (child) {

        var $tag = $(child);
        var tagName = ($tag.prop('tagName') || 'text').toLowerCase();

        // Tag doesn't allowed - remove and continue
        if (tagOptions.children[tagName] !== true || !compiledRules[tagName]) {
          $tag.remove();
          return;
        }

        // Sanitize attributes
        var attrOptions = compiledRules[tagName].attributes;

        // If `attrOptions` is false - skip attributes check
        if (attrOptions !== false) {
          _.forEach($tag.attrs(), function (value, name) {
            if (!attrOptions[name] || !attrOptions[name].test(value)) {
              $tag.removeAttr(name);
            }
          });
        }

        // Sanitize children tags
        if (compiledRules[tagName].children !== false) {
          sanitizeChildren($tag, compiledRules[tagName]);
        }
      });

      // Remove empty tag
      if (parent.contents().length === 0 && tagOptions.remove_empty === true) {
        parent.remove();
      }
    }

    // Recursively run `sanitizeChildren` from `root` tag
    parser.bus.on('sanitize', function sanitize(data) {
      sanitizeChildren(data.ast, compiledRules.root);
    });
  };
};
