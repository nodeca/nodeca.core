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

    ///////////////////////////////////////////////////////////////////////////
    // Add attachments as `attach` tag to AST

    var defaultImageRender = parser.md.renderer.rules.image;

    parser.md.renderer.rules.image = function (tokens, idx, options, env, self) {
      var match = _.find(N.router.matchAll(tokens[idx].src), function (match) {
        return match.meta.methods.get === 'users.media';
      });

      // It is not URL of media, continue
      if (!match) {
        return defaultImageRender(tokens, idx, options, env, self);
      }

      return '<attach data-nd-media-id="' + match.params.media_id + '" data-nd-src="' + tokens[idx].src + '"></attach>';
    };


    ///////////////////////////////////////////////////////////////////////////
    // Calculate attach tail

    parser.bus.on('transform', function calc_tail(data) {
      // Get refs from `attach` tag
      var refs = _.uniq(data.ast.find('attach').map(function () {
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


    ///////////////////////////////////////////////////////////////////////////
    // Render `attach` tag to link with image or to link

    parser.bus.on('render', function render_attachments(data) {
      var escapeHtml = parser.md.utils.escapeHtml;

      var binTpl = _.template('<a href="<%= href %>"><%= text %></a>');
      var imgTpl = _.template('<a href="<%= href %>"><img src="<%= src %>"></a>');

      var $attach, attachData, mediaId;

      data.ast.find('attach').each(function () {
        $attach = $(this);
        mediaId = $attach.data('nd-media-id');

        // Find attachment info (`file_name`, 'type') by `media_id`
        attachData = _.find(data.params.attachments, function (attach) {
          return attach.media_id === mediaId;
        });

        // If attachment is image replace `attach` tag to link and image
        if (attachData.type === mTypes.IMAGE) {
          $attach.replaceWith(imgTpl({
            href: $attach.data('nd-src'),
            src: N.router.linkTo('core.gridfs', { bucket: mediaId + '_sm' })
          }));
          return;
        }

        // If attachment is binary replace `attach` tag to link
        if (attachData.type === mTypes.BINARY) {
          $attach.replaceWith(binTpl({
            href: $attach.data('nd-src'),
            text: escapeHtml(attachData.file_name)
          }));
          return;
        }

        // Remove if invalid attachment type
        $attach.remove();
      });
    });
  };
};
