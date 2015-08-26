'use strict';


var _ = require('lodash');


N.wire.once('init:parser', function attachment_plugin_init() {
  var plugin = require('nodeca.core/lib/parser/plugins/attachment')(N, {
    types: '$$ JSON.stringify(N.models.users.MediaInfo.types) $$',
    sizes: '$$ JSON.stringify(N.config.users.uploads.resize) $$'
  });

  N.parse.addPlugin(
    'attachment',
    function (parser) {
      parser.bus.on('render', function fetch_attachment_data(data) {
        if (!data.params.rpc_cache) {
          return;
        }

        data.ast.find('.image').each(function () {
          var $attach = $(this);
          var match = _.find(N.router.matchAll($attach.attr('src')), function (match) {
            return match.meta.methods.get === 'users.media';
          });

          if (!match) {
            return;
          }

          $attach.attr('data-nd-media-id', match.params.media_id);

          var result = data.params.rpc_cache.get('common.content.attachment', { id: match.params.media_id });

          if (!result || !result.type) {
            return;
          }

          $attach.data('nd-media-type', result.type);
          $attach.data('nd-media-filename', result.file_name);
        });
      });


      // Calculate attach tail
      //
      parser.bus.on('render', function fetch_tail(data) {
        // Get refs from `attach` tag
        var refs = _.uniq(data.ast.find('[data-nd-media-id]').map(function () {
          return $(this).data('nd-media-id');
        }));

        var tail = _.uniq(data.params.attachments).map(function (media_id) {
          if (refs.indexOf(media_id) !== -1) {
            // attach referenced in message body, so remove it from tail
            return null;
          }

          var result = data.params.rpc_cache.get('common.content.attachment', { id: media_id });

          if (!result || !result.type) {
            return null;
          }

          return {
            type:      result.type,
            media_id:  media_id,
            file_name: result.file_name
          };
        }).filter(Boolean);

        data.result.tail = tail;
      });


      plugin(parser);
    }
  );
});
