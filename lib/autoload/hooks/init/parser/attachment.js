
'use strict';


var async = require('async');
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
          async.eachSeries(data.ast.find('.image'), function (item, next) {
            var $attach = $(item);
            var match = _.find(N.router.matchAll($attach.attr('src')), function (match) {
              return match.meta.methods.get === 'users.media';
            });

            if (!match) {
              next();
              return;
            }

            $attach.attr('data-nd-media-id', match.params.media_id);

            var result = { id: match.params.media_id };

            N.wire.emit('internal:common.content.attachment', result, function (err) {
              if (err) {
                next();
                return;
              }

              if (!result.type) {
                next();
                return;
              }

              $attach.data('nd-media-type', result.type);
              $attach.data('nd-media-filename', result.file_name);

              next();
            });
          }, callback);
        });


        // Calculate attach tail
        //
        parser.bus.on('render', function fetch_tail(data, callback) {
          // Get refs from `attach` tag
          var refs = _.uniq(data.ast.find('[data-nd-media-id]').map(function () {
            return $(this).data('nd-media-id');
          }));

          async.map(_.uniq(data.params.attachments), function (media_id, next) {
            if (refs.indexOf(media_id) !== -1) {
              // attach referenced in message body, so remove it from tail
              next();
              return;
            }

            var result = { id: media_id };

            N.wire.emit('internal:common.content.attachment', result, function (err) {
              if (err) {
                next();
                return;
              }

              if (!result.type) {
                next();
                return;
              }

              next(null, {
                type:      result.type,
                media_id:  media_id,
                file_name: result.file_name
              });
            });
          }, function (err, tail) {
            if (err) {
              callback(err);
              return;
            }

            data.result.tail = tail.filter(Boolean);
            callback();
          });
        });

        plugin(parser);
      }
    );
  });
};
