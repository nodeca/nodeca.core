// Quote parser plugin
//

'use strict';


var _        = require('lodash');
var $        = require('../cheequery');
var render   = require('nodeca.core/lib/system/render/common');
var linkify  = require('linkify-it')({ fuzzyLink: false });
var beautify = require('../beautify_url');
var md_quote = require('./lib/md-quote');


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
    var blockLinkTpl = _.template('<p><a class="link link-ext" href="<%- href %>" target="_blank" rel="nofollow">' +
      '<%- content %></a></p>');
    var attachTpl = _.template('<a class="icon icon-picture attach-collapsed" ' +
      'href="<%- href %>"></a>');
    var imageTpl = _.template('<a class="icon icon-picture image-collapsed" ' +
      'href="<%- href %>" target="_blank" rel="nofollow"></a>');

    parser.md.use(md_quote, {
      validate: is_url,
      render:   render_blockquote
    });

    parser.md.use(require('markdown-it-container'), 'quote', {
      marker: '`',
      render: render_fenced_quote
    });

    // default quote renderer
    parser.bus.after('render', function render_quote(data) {
      data.ast.find('msg-quote').each(function () {
        var element     = $(this);
        var locals      = {};
        var title       = String(element.data('nd-title'));

        if (!is_url(title)) {
          locals.title = title;
        }

        var replacement = $(render(N, 'common.blocks.markup.quote', locals, {}));

        replacement.children('.quote__content').append(element.contents());
        element.replaceWith(replacement);
      });
    });

    // replace images, video, etc. with placeholders in quotes
    parser.bus.after('render', function quote_replace_contents(data) {
      if (!data.params.options.quote_collapse) { return; }

      data.ast.find('.quote__content').each(function () {
        var quote = $(this);

        // don't process nested quotes
        if (quote.parents('.quote__content').length) { return; }

        // remove quote/snippet headers and replace their contents with ellipses
        quote.find('.quote').each(function () {
          var replacement = $(render(N, 'common.blocks.markup.quote', {}, {}));

          replacement.children('.quote__content').append('…');
          $(this).replaceWith(replacement);
        });

        // replace all images within quotes with placeholders
        quote.find('.image, .attach').each(function () {
          var template = $(this).hasClass('attach') ? attachTpl : imageTpl;

          $(this).replaceWith(template({ href: $(this).data('nd-orig') }));
        });

        // replace media players with their urls
        quote.find('.ez-block').each(function () {
          $(this).replaceWith(blockLinkTpl({
            href:    $(this).data('nd-orig'),
            content: beautify($(this).data('nd-orig'), 50)
          }));
        });
      });
    });
  };
};
