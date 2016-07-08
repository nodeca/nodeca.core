// Image parser plugin
//
'use strict';


const _         = require('lodash');
const $         = require('../cheequery');
const charcount = require('charcount');


module.exports = function () {

  return function (parser) {
    parser.md.enable('image');

    ///////////////////////////////////////////////////////////////////////////
    // Images to HTML
    //
    const imgTpl = _.template(
      '<% if (width && height && wunits && hunits && wunits === hunits) { %>' +
      '<span class="image" style="width: <%- width %><%- wunits %>" data-nd-orig="<%- src %>">' +
      '<img src="<%- src %>" alt="<%- alt %>" title="<%- title %>">' +
      '<span class="image__spacer" style="padding-bottom: <%- (height/width*100).toFixed(4) %>%;">' +
      '</span>' +
      '<% } else { %>' +
      '<img class="image" data-nd-orig="<%- src %>" src="<%- src %>" alt="<%- alt %>" title="<%- title %>">' +
      '<% } %>'
    );


    // Add "image" class to all images in the document, assuming that img tags
    // could only come from markdown images at this point.
    //
    // It should be executed before all other renderer rules, because they
    // could add their own img tag (e.g. attachments rule adds thumbnails).
    //
    parser.bus.before('ast2html', { priority: -100 }, function add_image_class(data) {
      data.ast.find('img').addClass('image');
    });

    parser.bus.after('ast2html', function render_image(data) {
      data.ast.find('.image').each(function () {
        let $img = $(this);

        $img.replaceWith(imgTpl({
          src:    $img.attr('src'),
          alt:    $img.attr('alt'),
          title:  $img.attr('title'),
          width:  $img.data('nd-width'),
          height: $img.data('nd-height'),
          wunits: $img.data('nd-wunits'),
          hunits: $img.data('nd-hunits')
        }));
      });
    });


    ///////////////////////////////////////////////////////////////////////////
    // Images to preview
    //
    parser.bus.on('ast2preview', function replace_image_to_icon(data) {
      data.ast.find('img').replaceWith('<span class="icon icon-picture"></span>');
    });


    ///////////////////////////////////////////////////////////////////////////
    // Count characters in `src` attribute
    //
    parser.bus.on('ast2length', function calc_length(data) {
      data.ast.find('img').each(function () {
        data.result.text_length += charcount($(this).attr('src').replace(/\s+/g, ''));
      });
    });
  };
};
