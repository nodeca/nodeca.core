// Attachment parser plugin
// - add attachments as `<attach>` tag to AST
// - collect attach refs
// - remove attach refs from tail
// - render `<attach>` tag to link with image or to link
//
'use strict';


const _ = require('lodash');
const $ = require('../cheequery');


module.exports = function (N, pluginConfig) {

  var mTypes = pluginConfig.types;


  return function (parser) {

    // displayed only in preview when an attachment is not yet loaded
    // (it can be a binary attachment or an image)
    var placeholderTpl = _.template(
      '<span class="attach attach-img attach__m-placeholder attach__m-<%- size %>' +
        '<% if (size === "sm") { %>' +
          ' thumb thumb__m-responsive' +
        '<% } %>' +
      '"></span>');

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

    parser.bus.on('ast2html', function render_attachments(data) {
      data.ast.find('[data-nd-media-id]').each(function () {
        let $attach = $(this);
        let mediaId = $attach.data('nd-media-id');
        let type    = $attach.data('nd-media-type');
        let size    = $attach.data('nd-media-size');

        if ($attach.data('nd-media-placeholder')) {
          // Client only, no data fetched yet, so showing placeholder
          let replacement = $(placeholderTpl({
            id:   mediaId,
            href: $attach.attr('src'),
            size
          }));

          $attach.replaceWith(replacement);

        } else if (type === mTypes.IMAGE || !type) {
          // If attachment is an image, replace it with an image attachment template;
          // if attachment does not exist, show it as a broken image
          let template = size === 'sm' ? imgTplSm : imgTpl;

          let replacement = $(template({
            id:     mediaId,
            href:   $attach.attr('src'),
            alt:    $attach.attr('alt'),
            title:  $attach.attr('title'),
            width:  $attach.data('nd-width'),
            height: $attach.data('nd-height'),
            size,
            src:    N.router.linkTo('core.gridfs', {
              bucket: mediaId + (size === 'orig' ? '' : '_' + size)
            })
          }));

          $attach.replaceWith(replacement);

        } else if (type === mTypes.BINARY) {
          // If attachment is binary, replace it with a binary attachment template
          let replacement = $(binTpl({
            id:   mediaId,
            href: $attach.attr('src'),
            text: $attach.data('nd-media-filename')
          }));

          $attach.replaceWith(replacement);
        }
      });
    });


    // Replace attach to icon
    //
    parser.bus.on('ast2preview', function replace_attach_to_icon(/* data */) {
      // TODO:
    });
  };
};
