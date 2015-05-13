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

    parser.md.renderer.rules.emoji = function (token, idx) {
      return '<emoji data-nd-content="' + escape(token[idx].content) + '"></emoji>';
    };

    parser.bus.on('render', function render_emojis(data) {
      data.ast.find('emoji').each(function () {
        var el = $(this);

        el.replaceWith('<span>' + escape(el.data('nd-content')) + '</span>');
      });
    });
  };
};
