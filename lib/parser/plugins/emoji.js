// Emoji parser plugin
//

'use strict';


var _ = require('lodash');
var $ = require('../cheequery');


module.exports = function (N, pluginConfig) {

  return function (parser) {
    var internalTpl = _.template('<msg-emoji data-nd-name="<%- name %>" data-nd-content="<%- content %>"></msg-emoji>');
    var renderTpl   = _.template('<span class="emoji emoji-<%- name %>"><%- content %></span>');

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

    parser.bus.on('md2html.render', function render_emoji(data) {
      data.ast.find('msg-emoji').each(function () {
        var el      = $(this);

        el.replaceWith(renderTpl({
          name:    el.data('nd-name'),
          content: el.data('nd-content')
        }));
      });
    });


    // Allow emoji in preview
    //
    parser.bus.on('html2preview.render', function allow_emoji(data) {
      data.whitelist.push('span.emoji');
    });
  };
};
