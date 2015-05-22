// Attachments parser plugin
// - add attachments as `<attach>` tag to AST
// - collect attach refs
// - remove attach refs from tail
// - render `<attach>` tag to link with image or to link
//
'use strict';


var _ = require('lodash');
var $ = require('../cheequery');


module.exports = function (N, mTypes) {

  return function (parser) {

    var binTpl = _.template(
      '<a href="<%- href %>" class="attach attach-bin thumb" data-nd-media-id="<%- id %>">' +
        '<span class="thumb__icon icon icon-binary"></span>' +
        '<span class="thumb__content"><%- text %></span>' +
      '</a>');

    var imgTpl = _.template(
      '<a href="<%- href %>" class="attach attach-img thumb" data-nd-media-id="<%- id %>">' +
        '<img class="thumb__image" src="<%- src %>">' +
      '</a>');


    ///////////////////////////////////////////////////////////////////////////
    // Render `attach` tag to link with image or to link

    parser.bus.on('render', function render_attachments(data) {
      var $attach, attachData, match, mediaId;

      data.ast.find('.image').each(function () {
        $attach = $(this);

        match = _.find(N.router.matchAll($attach.attr('src')), function (match) {
          return match.meta.methods.get === 'users.media';
        });

        if (!match) {
          return;
        }

        mediaId = match.params.media_id;

        // Find attachment info (`file_name`, 'type') by `media_id`
        attachData = _.find(data.params.attachments, function (attach) {
          return attach.media_id === mediaId;
        });

        // If attachment is an image, replace it with an image attachment template
        if (attachData && attachData.type === mTypes.IMAGE) {
          $attach.replaceWith(imgTpl({
            id:   mediaId,
            href: $attach.data('nd-src'),
            src:  N.router.linkTo('core.gridfs', { bucket: mediaId + '_sm' })
          }));
          return;
        }

        // If attachment is binary, replace it with a binary attachment template
        if (attachData && attachData.type === mTypes.BINARY) {
          $attach.replaceWith(binTpl({
            id:   mediaId,
            href: $attach.data('nd-src'),
            text: attachData.file_name
          }));
          return;
        }

        // Invalid attachment type or an unrecognized attach, remove it
        $attach.remove();
      });
    });


    ///////////////////////////////////////////////////////////////////////////
    // Calculate attach tail

    parser.bus.on('render', function calc_tail(data) {
      // Get refs from `attach` tag
      var refs = _.uniq(data.ast.find('.attach').map(function () {
        return $(this).data('nd-media-id');
      }));

      var tail = _.uniq(data.params.attachments, function (attach) {
        return attach.media_id;
      });

      tail = tail.filter(function (attach) {
        return refs.indexOf(attach.media_id) === -1;
      });

      data.result.tail = tail;
    });
  };
};
