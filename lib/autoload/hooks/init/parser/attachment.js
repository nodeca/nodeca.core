
'use strict';


var _     = require('lodash');
var $     = require('nodeca.core/lib/parser/cheequery');


module.exports = function (N) {
  // Fetch attachments metadata and store it into `image_info`
  //
  // Input:
  //
  //  - data (Object) - parser data object
  //  - refs (Array)  - array of [ media_id, size_name ]
  //
  function fetch_attachments_meta(data, refs, callback) {
    var attachments = {};
    var unknown_refs = [];

    refs.forEach(function (ref) {
      var id = ref[0];
      var size = ref[1];
      var attach_params = (data.params.image_info || {})['media:' + id + '_' + size];

      if (attach_params && attach_params.type) {
        attachments[id] = _.pick(attach_params, [ 'type', 'file_name' ]);
      } else {
        unknown_refs.push(ref);
      }
    });

    var attach_list = {
      ids: _.uniq(unknown_refs.map(function (r) { return r[0]; }).sort(), true)
    };

    N.wire.emit('internal:common.content.attachments', attach_list, function (err) {
      if (err) {
        callback(err);
        return;
      }

      var result = _.assign(attachments, attach_list.attachments);

      unknown_refs.forEach(function (ref) {
        var id = ref[0];
        var size = ref[1];
        var key = 'media:' + id + '_' + size;

        if (!result[id]) { return; }

        data.result.image_info[key] = _.assign(_.omit({
          type:      result[id].type,
          file_name: result[id].file_name,
          width:     result[id].image_sizes && result[id].image_sizes[size] && result[id].image_sizes[size].width,
          height:    result[id].image_sizes && result[id].image_sizes[size] && result[id].image_sizes[size].height
        }, _.isUndefined), (data.params.image_info || {})[key]);
      });

      callback();
    });
  }

  N.wire.once('init:parser', function attachment_plugin_init() {
    var plugin = require('nodeca.core/lib/parser/plugins/attachment')(N, {
      types: N.models.users.MediaInfo.types
    });

    var sizes = N.config.users.uploads.resize;

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

            // Get a size from img alt attribute, e.g.:
            //  - ![md](link)
            //  - ![arbitrary text|md](link)
            //
            var alt = $attach.attr('alt') || '';
            var pos = alt.lastIndexOf('|');
            var size;

            if (pos !== -1) {
              size = alt.slice(pos + 1).trim();
              alt = alt.slice(0, pos);
            } else {
              size = alt.trim();
              alt = '';
            }

            if (sizes[size]) {
              $attach.attr('alt', alt);
            } else {
              size = 'sm';
            }

            $attach.data('nd-media-size', size);
          });

          // Fetch all images and calculate attach tail
          //
          var refs = [];

          data.ast.find('[data-nd-media-id]').map(function () {
            refs.push([ $(this).data('nd-media-id'), $(this).data('nd-media-size') ]);
          });

          var tail_refs = data.params.attachments.filter(function (media_id) {
            return !_.find(refs, function (r) { return r[0] === String(media_id); });
          }).map(function (id) {
            return [ id, 'sm' ];
          });

          fetch_attachments_meta(data, tail_refs.concat(refs), function (err) {
            if (err) {
              // ignore errors
              callback();
              return;
            }

            data.ast.find('[data-nd-media-id]').each(function () {
              var $attach = $(this);
              var id = $attach.data('nd-media-id');
              var size = $attach.data('nd-media-size');
              var attach_meta = data.result.image_info['media:' + id + '_' + size];

              if (!attach_meta) { return; }

              $attach.data('nd-media-type', attach_meta.type);
              $attach.data('nd-media-filename', attach_meta.file_name);
            });

            data.result.tail = tail_refs.map(function (ref) {
              var id = ref[0];
              var size = ref[1];
              var attach_meta = data.result.image_info['media:' + id + '_' + size];

              if (!attach_meta) { return null; }

              return _.omit({
                media_id:  id,
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
