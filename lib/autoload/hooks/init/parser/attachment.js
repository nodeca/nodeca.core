
'use strict';


var _     = require('lodash');
var $     = require('nodeca.core/lib/parser/cheequery');


module.exports = function (N) {

  N.wire.once('init:parser', function attachment_plugin_init() {
    var plugin = require('nodeca.core/lib/parser/plugins/attachment')(N, {
      types: N.models.users.MediaInfo.types,
      sizes: N.config.users.uploads.resize
    });

    N.parse.addPlugin(
      'attachment',
      function (parser) {
        parser.bus.on('render', function fetch_attachment_data(data, callback) {
          // find all images that point to an attachment and set data-nd-media-id attr
          data.ast.find('.image').each(function () {
            var $attach = $(this);
            var match = _.find(N.router.matchAll($attach.attr('src')), function (match) {
              return match.meta.methods.get === 'users.media';
            });

            if (!match) {
              return;
            }

            $attach.attr('data-nd-media-id', match.params.media_id);
          });

          // Fetch all images and calculate attach tail
          //
          var refs = [];

          data.ast.find('[data-nd-media-id]').map(function () {
            refs.push($(this).data('nd-media-id'));
          });

          var tail_ids = data.params.attachments.filter(function (media_id) {
            return refs.indexOf(media_id) === -1;
          });

          var result = { ids: _.uniq(tail_ids.concat(refs)) };

          N.wire.emit('internal:common.content.attachments', result, function (err) {
            if (err) {
              callback();
              return;
            }

            var attachments = result.attachments || {};

            data.ast.find('[data-nd-media-id]').each(function () {
              var $attach = $(this);
              var media_id = $attach.data('nd-media-id');

              if (!attachments[media_id]) { return; }

              $attach.data('nd-media-type', attachments[media_id].type);
              $attach.data('nd-media-filename', attachments[media_id].file_name);
            });

            data.result.tail = tail_ids.map(function (media_id) {
              if (!attachments[media_id]) { return null; }

              return _.omit({
                media_id:  media_id,
                type:      attachments[media_id].type,
                file_name: attachments[media_id].file_name
              }, _.isUndefined);
            }).filter(Boolean);

            callback();
          });
        });

        plugin(parser);
      }
    );
  });
};
