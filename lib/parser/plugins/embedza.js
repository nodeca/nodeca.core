// Embedza parser plugin
//
'use strict';


const $        = require('../cheequery');
const _        = require('lodash');
const beautify = require('nodeca.core/lib/parser/beautify_url');


module.exports = function () {
  const linkTpl = _.template('<a href="<%- href %>" target="_blank" rel="nofollow"><%- content %></a>');
  const spanTpl = _.template('<span class="preview__link"><%- content %></span>');

  return function (parser) {

    // Replace block embedza to text or to link
    //
    parser.bus.on('html2preview.render', function replace_block_embedza(data) {
      data.ast.find('.ez-block').each(function () {
        if (data.params.link2text) {
          data.whitelist.push('span.preview__link');

          $(this).replaceWith(spanTpl({
            content: beautify($(this).data('nd-orig'), 50)
          }));
        } else {
          data.whitelist.push('a');

          $(this).replaceWith(linkTpl({
            href:    $(this).data('nd-orig'),
            content: beautify($(this).data('nd-orig'), 50)
          }));
        }
      });
    });


    // Replace inline embedza to text
    //
    parser.bus.on('html2preview.render', function replace_inline_embedza(data) {
      if (data.params.link2text) {
        data.whitelist.push('span.preview__link');

        data.ast.find('.ez-inline').each(function () {
          $(this).replaceWith(spanTpl({
            content: beautify($(this).data('nd-orig'), 50)
          }));
        });
      }
    });
  };
};
