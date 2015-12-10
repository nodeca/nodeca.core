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


  return function (parser) {

    // displayed only in preview when an attachment is not yet loaded
    // (it can be a binary attachment or an image)
    var placeholderTpl = _.template(
      '<a href="<%- href %>" class="attach attach-img thumb thumb__m-responsive"' +
      ' data-nd-media-id="<%- id %>" data-nd-orig="<%- href %>"></a>');

    // template for binary attachments
    var binTpl = _.template(
      '<a href="<%- href %>" class="attach attach-bin thumb thumb__m-responsive"' +
          ' data-nd-media-id="<%- id %>" data-nd-orig="<%- href %>">' +
        '<span class="thumb__icon icon icon-binary"></span>' +
        '<span class="thumb__content"><%- text %></span>' +
      '</a>');

    // template for image attachments ("sm" size only)
    var imgTplSm = _.template(
      '<a href="<%- href %>" class="attach attach-img thumb thumb__m-responsive"' +
          ' data-nd-media-id="<%- id %>" data-nd-orig="<%- href %>">' +
        '<img class="thumb__image" src="<%- src %>" alt="<%- alt %>" title="<%- title %>" ' +
          '<% if (width || height) { %>' +
            ' width="<%- width %>" height="<%- height %>"' +
          '<% } %>' +
        '>' +
      '</a>');

    // template for image attachments (other sizes: "md", "orig", etc.)
    var imgTpl = _.template(
      '<% if (width && height) { %>' +
        '<span class="attach attach-img attach__m-<%- size %>"' +
          ' data-nd-media-id="<%- id %>"' +
          ' data-nd-orig="<%- href %>"' +
          ' style="width: <%- width %>px"' +
        '>' +
          '<span class="attach__spacer" style="padding-bottom: <%- (height/width*100).toFixed(4) %>%;"></span>' +
          '<img src="<%- src %>" alt="<%- alt %>" title="<%- title %>">' +
          '<a class="attach__link-control icon icon-link" href="<%- href %>"></a>' +
        '</span>' +
      '<% } else { %>' +
        '<span class="attach attach-img attach__m-<%- size %>"' +
          ' data-nd-media-id="<%- id %>"' +
          ' data-nd-orig="<%- href %>"' +
        '>' +
          '<img src="<%- src %>" alt="<%- alt %>" title="<%- title %>">' +
          '<a class="attach__link-control icon icon-link" href="<%- href %>"></a>' +
        '</span>' +
      '<% } %>');

    ///////////////////////////////////////////////////////////////////////////
    // Render `attach` tag to link with image or to link

    parser.bus.on('render', function render_attachments(data) {
      var $attach, type, mediaId, replacement, size;

      data.ast.find('[data-nd-media-id]').each(function () {
        $attach = $(this);
        mediaId = $attach.data('nd-media-id');
        type    = $attach.data('nd-media-type');
        size    = $attach.data('nd-media-size');

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
          var info = data.result.image_info[key] || (data.params.image_info || {})[key];

          if (info) {
            // set image width and height if available
            width = info.width;
            height = info.height;
            data.result.image_info[key] = info;
          } else {
            // schedule image size fetch
            data.result.image_info[key] = null;
          }

          var template = size === 'sm' ? imgTplSm : imgTpl;

          replacement = $(template({
            id:     mediaId,
            href:   $attach.attr('src'),
            alt:    $attach.attr('alt'),
            title:  $attach.attr('title'),
            width:  width,
            height: height,
            size:   size,
            src:    N.router.linkTo('core.gridfs', {
              bucket: mediaId + (size === 'orig' ? '' : '_' + size)
            })
          }));

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
