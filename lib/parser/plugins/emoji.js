// Emoji parser plugin
//
'use strict';


const _ = require('lodash');
const $ = require('../cheequery');


module.exports = function (N, pluginConfig) {

  return function (parser) {

    ///////////////////////////////////////////////////////////////////////////
    // Emoji to AST
    //
    const internalTpl = _.template(
      '<msg-emoji data-nd-name="<%- name %>" data-nd-content="<%- content %>"></msg-emoji>'
    );

    // We only use `/light` here to prevent bundling extensive configs
    // that come with the plugin.
    //
    parser.md.use(require('markdown-it-emoji/light'), {
      defs:      pluginConfig.named,
      shortcuts: pluginConfig.aliases
    });

    parser.md.renderer.rules.emoji = function (tokens, idx) {
      return internalTpl({
        name:    tokens[idx].markup,
        content: tokens[idx].content
      });
    };


    ///////////////////////////////////////////////////////////////////////////
    // emoji to HTML and preview
    //
    const renderTpl   = _.template('<span class="emoji emoji-<%- name %>"><%- content %></span>');


    parser.bus.on([ 'ast2html', 'ast2preview' ], function render_emoji(data) {
      data.ast.find('msg-emoji').each(function () {
        var el      = $(this);

        el.replaceWith(renderTpl({
          name:    el.data('nd-name'),
          content: el.data('nd-content')
        }));
      });
    });
  };
};
