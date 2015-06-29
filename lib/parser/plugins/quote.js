// Quote parser plugin
//

'use strict';


var $      = require('../cheequery');
var render = require('nodeca.core/lib/system/render/common');


module.exports = function (N) {

  function render_quote(tokens, idx, options, env, _self) {
    tokens[idx].tag = 'msg-quote';

    if (tokens[idx].nesting === 1) {
      tokens[idx].attrPush([ 'data-nd-title', tokens[idx].info.replace(/^quote/, '').trim() ]);
    }

    return _self.renderToken(tokens, idx, options, env, _self);
  }

  return function (parser) {
    parser.md.use(require('markdown-it-container'), 'quote', {
      marker: '`',
      render: render_quote
    });

    parser.bus.after('render', function render_quote(data) {
      data.ast.find('msg-quote').each(function () {
        var element     = $(this);
        var locals      = { title: element.data('nd-title') };
        var replacement = $(render(N, 'common.blocks.markup.quote', locals, {}));

        replacement.children('.quote__content').append(element.contents());
        element.replaceWith(replacement);
      });
    });
  };
};
