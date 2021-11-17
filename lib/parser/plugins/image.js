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
    const imgTpl = _.template(`
      <% if (width && height && units) { %>
        <span class="image" style="width: <%- width %><%- units %>" data-nd-image-orig="<%- src %>">
        <img src="<%- src %>" alt="<%- alt %>" title="<%- title %>">
        <span class="image__spacer" style="padding-bottom: <%- (height/width*100).toFixed(4) %>%;">
        </span>
      <% } else { %>
        <img class="image" data-nd-image-orig="<%- src %>" src="<%- src %>" alt="<%- alt %>" title="<%- title %>">
      <% } %>`.replace(/\n\s*/g, ''));


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

        let width  = $img.data('nd-width');
        let height = $img.data('nd-height');
        let wunits = $img.data('nd-wunits');
        let hunits = $img.data('nd-hunits');
        let mime   = $img.data('nd-mime');

        if (mime === 'image/jpeg' && $img.data('nd-orientation') >= 5) {
          // swap width/height for jpeg only, because browsers
          // currently only support jpeg orientation
          [ width, height ] = [ height, width ];
        }

        $img.replaceWith(imgTpl({
          src:    $img.attr('src'),
          alt:    $img.attr('alt'),
          title:  $img.attr('title'),
          width,
          height,
          units:  wunits === hunits ? wunits : ''
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
