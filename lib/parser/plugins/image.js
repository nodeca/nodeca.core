// Image parser plugin
//
'use strict';


const $         = require('../cheequery');
const beautify  = require('../beautify_url');
const charcount = require('charcount');
const render    = require('nodeca.core/lib/system/render/common');


module.exports = function (N) {

  return function (parser) {
    parser.md.enable('image');

    ///////////////////////////////////////////////////////////////////////////
    // Images to HTML
    //

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

        let locals = {
          src:    $img.attr('src'),
          alt:    $img.attr('alt'),
          title:  $img.attr('title'),
          width,
          height,
          units:  wunits === hunits ? wunits : '',
          filesize: $img.data('nd-length')
        };

        let replacement = $(render(N, 'common.blocks.markup.image', locals, { beautify }));

        $img.replaceWith(replacement);
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
