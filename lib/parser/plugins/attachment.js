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
      var $attach, attachData, match, mediaId, replacement, size;

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


        if (attachData && attachData.type === mTypes.IMAGE) {
          // If attachment is an image, replace it with an image attachment template
          replacement = $(imgTpl({
            id:   mediaId,
            href: $attach.attr('src'),
            src:  N.router.linkTo('core.gridfs', {
              bucket: mediaId + (size === 'orig' ? '' : '_' + size)
            })
          }));

          if (size !== 'sm') {
            replacement.addClass('thumb__m-' + size);
          }

          $attach.replaceWith(replacement);

        } else if (attachData && attachData.type === mTypes.BINARY) {
          // If attachment is binary, replace it with a binary attachment template
          replacement = $(binTpl({
            id:   mediaId,
            href: $attach.attr('src'),
            text: attachData.file_name
          }));

          $attach.replaceWith(replacement);

        } else if (!replacement) {
          // Invalid attachment type or an unrecognized attach, remove it
          $attach.remove();
        }
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
