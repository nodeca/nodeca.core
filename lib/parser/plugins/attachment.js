// Attachment parser plugin
// - add attachments as `<attach>` tag to AST
// - collect attach refs
// - remove attach refs from tail
// - render `<attach>` tag to link with image or to link
//
'use strict';


var _ = require('lodash');
var $ = require('../cheequery');


module.exports = function (N, pluginConfig) {

  var mTypes = pluginConfig.types;
  var sizes  = pluginConfig.sizes;


  return function (parser) {

    var placeholderTpl = _.template(
      '<a href="<%- href %>" class="attach attach-img thumb thumb__m-responsive" data-nd-media-id="<%- id %>">' +
      '</a>');

    var binTpl = _.template(
      '<a href="<%- href %>" class="attach attach-bin thumb thumb__m-responsive" data-nd-media-id="<%- id %>">' +
        '<span class="thumb__icon icon icon-binary"></span>' +
        '<span class="thumb__content"><%- text %></span>' +
      '</a>');

    var imgTpl = _.template(
      '<a href="<%- href %>" class="attach attach-img thumb thumb__m-responsive" data-nd-media-id="<%- id %>">' +
        '<img class="thumb__image" src="<%- src %>" ' +
          '<% if (width || height) { %>' +
            ' width="<%- width %>" height="<%- height %>"' +
          '<% } %>' +
        '>' +
      '</a>');


    ///////////////////////////////////////////////////////////////////////////
    // Render `attach` tag to link with image or to link

    parser.bus.on('render', function render_attachments(data) {
      var $attach, type, mediaId, replacement, size;

      data.ast.find('[data-nd-media-id]').each(function () {
        $attach = $(this);
        mediaId = $attach.data('nd-media-id');
        type    = $attach.data('nd-media-type');

        // Get a size from img alt attribute, e.g.:
        //  - ![md](link)
        //  - ![arbitrary text|md](link)
        //
        size = $attach.attr('alt');

        if (size.indexOf('|') !== -1) {
          size = size.slice('|');
        }

        size = size.trim();

        if (!sizes[size]) {
          size = 'sm';
        }


        if ($attach.data('nd-media-placeholder')) {
          // Client only, no data fetched yet, so showing placeholder
          replacement = $(placeholderTpl({
            id:   mediaId,
            href: $attach.attr('src')
          }));

          $attach.replaceWith(replacement);

        } else if (type === mTypes.IMAGE) {
          // If attachment is an image, replace it with an image attachment template
          var width, height, key = 'media:' + mediaId + '_' + size;

          if (data.result.image_info[key]) {
            // set image width and height if available
            width = data.result.image_info[key].width;
            height = data.result.image_info[key].height;
          } else {
            // schedule image size fetch
            data.result.image_info[key] = null;
          }

          replacement = $(imgTpl({
            id:     mediaId,
            href:   $attach.attr('src'),
            width:  width,
            height: height,
            src:    N.router.linkTo('core.gridfs', {
              bucket: mediaId + (size === 'orig' ? '' : '_' + size)
            })
          }));

          if (size !== 'sm') {
            replacement.addClass('thumb__m-' + size);
          }

          $attach.replaceWith(replacement);

        } else if (type === mTypes.BINARY) {
          // If attachment is binary, replace it with a binary attachment template
          replacement = $(binTpl({
            id:   mediaId,
            href: $attach.attr('src'),
            text: $attach.data('nd-media-filename')
          }));

          $attach.replaceWith(replacement);

        } else if (!replacement) {
          // Invalid attachment type or an unrecognized attach, remove it
          $attach.remove();
        }
      });
    });
  };
};
