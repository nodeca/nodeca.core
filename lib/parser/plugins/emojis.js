// smiles parser plugin
//

'use strict';


var $ = require('../cheequery');


module.exports = function (N, pluginConfig) {

  return function (parser) {
    var escape = parser.md.utils.escapeHtml;

    // We only use `/light` here to prevent bundling extensive configs
    // that come with the plugin.
    //
    parser.md.use(require('markdown-it-emoji/light'), {
      defs:      pluginConfig.named,
      shortcuts: pluginConfig.aliases
    });

    parser.md.renderer.rules.emoji = function (tokens, idx) {
      var content = escape(tokens[idx].content);
      var name    = escape(tokens[idx].markup);

      return '<emoji data-nd-id="' + name + '" data-nd-content="' + content + '"></emoji>';
    };

    parser.bus.on('render', function render_emojis(data) {
      data.ast.find('emoji').each(function () {
        var el      = $(this);
        var name    = escape(el.data('nd-id'));
        var content = escape(el.data('nd-content'));

        el.replaceWith('<span class="emoji emoji-' + name + '">' + content + '</span>');
      });
    });
  };
};
