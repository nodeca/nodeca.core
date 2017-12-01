// Attachment parser plugin
// - add attachments as `<attach>` tag to AST
// - collect attach refs
// - remove attach refs from tail
// - render `<attach>` tag to link with image or to link
//
'use strict';


const $      = require('../cheequery');
const render = require('nodeca.core/lib/system/render/common');


module.exports = function (N) {

  return function (parser) {

    ///////////////////////////////////////////////////////////////////////////
    // Render `attach` tag to link with image or to link

    parser.bus.on('ast2html', function render_attachments(data) {
      data.ast.find('[data-nd-media-id]').each(function () {
        let $attach  = $(this);
        let media_id = $attach.data('nd-media-id');
        let size     = $attach.data('nd-media-size');

        let locals = {
          type:   $attach.data('nd-media-type'),
          media_id,
          href:   $attach.attr('src'),
          size,

          // for images
          alt:    $attach.attr('alt'),
          title:  $attach.attr('title'),
          width:  Number($attach.data('nd-width')),
          height: Number($attach.data('nd-height')),
          src:    N.router.linkTo('core.gridfs', {
            bucket: media_id + (size === 'orig' ? '' : '_' + size)
          }),

          // for binary
          text:   $attach.data('nd-media-filename'),

          // placeholder flag (client-side only)
          is_placeholder: $attach.data('nd-media-placeholder')
        };

        let replacement = $(render(N, 'common.blocks.markup.attachment', locals, {}));

        $attach.replaceWith(replacement);
      });
    });


    // Replace attach to icon
    //
    parser.bus.on('ast2preview', function replace_attach_to_icon(/* data */) {
      // TODO:
    });
  };
};
