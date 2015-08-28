
'use strict';


var _     = require('lodash');
var $     = require('nodeca.core/lib/parser/cheequery');


module.exports = function (N) {

  // Fetch attachments metadata and store it into `image_info`
  //
  // Input:
  //
  //  - data (Object) - parser data object
  //  - ids  (Array) - array of attachment ids
  //
  function fetch_attachments_meta(data, ids, callback) {
    var attachments = {};
    var unknown_ids = [];

    _.uniq(ids.sort(), true).forEach(function (id) {
      var attach_params = data.result.image_info['media:' + id];

      if (attach_params && attach_params.type) {
        attachments[id] = _.pick(attach_params, [ 'type', 'file_name' ]);
      } else {
        unknown_ids.push(id);
      }
    });

    var attach_list = { ids: unknown_ids };

    N.wire.emit('internal:common.content.attachments', attach_list, function (err) {
      if (err) {
        callback(err);
        return;
      }

      var result = _.assign(attachments, attach_list.attachments);

      unknown_ids.forEach(function (id) {
        data.result.image_info['media:' + id] = _.assign(_.omit({
          type: result[id].type,
          file_name: result[id].file_name
        }, _.isUndefined), data.result.image_info['media:' + id]);
      });

      callback();
    });
  }

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

          fetch_attachments_meta(data, tail_ids.concat(refs), function (err) {
            if (err) {
              // ignore errors
              callback();
              return;
            }

            data.ast.find('[data-nd-media-id]').each(function () {
              var $attach = $(this);
              var media_id = $attach.data('nd-media-id');
              var attach_meta = data.result.image_info['media:' + media_id];

              if (!attach_meta) { return; }

              $attach.data('nd-media-type', attach_meta.type);
              $attach.data('nd-media-filename', attach_meta.file_name);
            });

            data.result.tail = tail_ids.map(function (media_id) {
              var attach_meta = data.result.image_info['media:' + media_id];

              if (!attach_meta) { return null; }

              return _.omit({
                media_id:  media_id,
                type:      attach_meta.type,
                file_name: attach_meta.file_name
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
