// Attachments parser plugin
// - add attachments as `<attach>` tag to AST
// - collect attach refs
// - remove attach refs from tail
// - render `<attach>` tag to link with image or to link
//
'use strict';

var _ = require('lodash');
var $ = require('../cheequery');

module.exports = function (N) {

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

      var title = tokens[idx].tokens.length === 1 && tokens[idx].tokens[0].type === 'text' ?
                  parser.md.utils.escapeHtml(parser.md.utils.replaceEntities(tokens[idx].tokens[0].content)) :
                  '';
      var type = title === '' ? 'attach_img' : 'attach_bin';

      return '<attach' +
        ' data-nd-src="' + tokens[idx].src + '"' +
        ' data-nd-type="' + type + '"' +
        ' data-nd-media-id="' + match.params.media_id + '"' +
        ' data-nd-title="' + title + '" />';
    };


    ///////////////////////////////////////////////////////////////////////////
    // Collect refs, remove refs from tail

    parser.bus.on('transform', function (data) {
      var refs = _.uniq(data.ast.find('attach').map(function () {
        return $(this).data('nd-media-id');
      }));

      var tail = _.uniq(data.params.attachments, function (attach) {
        return attach.media_id;
      });

      tail = tail.filter(function (attach) {
        return refs.indexOf(attach.media_id) === -1;
      });

      refs = refs.concat(tail.map(function (attach) {
        return attach.media_id;
      }));

      data.result.attachments.refs = refs;
      data.result.attachments.tail = tail;
    });


    ///////////////////////////////////////////////////////////////////////////
    // Render `attach` tag to link with image or to link

    parser.bus.on('render', function (data) {
      data.ast.find('attach').map(function () {
        var $attach = $(this);
        var $replace = $('<a>');

        $replace.attr('href', $attach.data('nd-src'));

        if ($attach.data('nd-type') === 'attach_img') {
          $replace.append(
            $('<img>').attr('src', N.router.linkTo('core.gridfs', { bucket: $attach.data('nd-media-id') + '_sm' }))
          );
        } else {
          $replace.text($attach.data('nd-title'));
        }

        $attach.replaceWith($replace);
      });
    });
  };
};
