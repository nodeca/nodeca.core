// Quote parser plugin
//

'use strict';


var $        = require('../cheequery');
var render   = require('nodeca.core/lib/system/render/common');
var md_quote = require('./md-quote');
var linkify  = require('linkify-it')({ fuzzyLink: false });


module.exports = function (N) {
  function is_url(text) {
    var match = text.match(/^https?:/);

    if (!match) { return false; }

    var proto = match[0];
    var len   = linkify.testSchemaAt(text, proto, proto.length);

    return len && (len === text.length - proto.length);
  }

  function render_fenced_quote(tokens, idx, options, env, _self) {
    tokens[idx].tag = 'msg-quote';

    if (tokens[idx].nesting === 1) {
      tokens[idx].attrPush([ 'data-nd-title', tokens[idx].info.replace(/^quote/, '').trim() ]);
    }

    return _self.renderToken(tokens, idx, options, env, _self);
  }

  function render_blockquote(tokens, idx, options, env, _self) {
    tokens[idx].tag = 'msg-quote';

    if (tokens[idx].nesting === 1) {
      tokens[idx].attrPush([ 'data-nd-title', tokens[idx].info ]);
    }

    return _self.renderToken(tokens, idx, options, env, _self);
  }

  return function (parser) {
    parser.md.use(md_quote, {
      validate: is_url,
      render:   render_blockquote
    });

    parser.md.use(require('markdown-it-container'), 'quote', {
      marker: '`',
      render: render_fenced_quote
    });

    parser.bus.after('render', function render_quote(data) {
      data.ast.find('msg-quote').each(function () {
        var element     = $(this);
        var locals      = {};
        var title       = element.data('nd-title');

        if (!is_url(title)) {
          locals.title = title;
        }

        var replacement = $(render(N, 'common.blocks.markup.quote', locals, {}));

        replacement.children('.quote__content').append(element.contents());
        element.replaceWith(replacement);
      });
    });
  };
};
