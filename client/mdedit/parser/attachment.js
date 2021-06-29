'use strict';


const _ = require('lodash');


// Get attachments and cache them
//
function get_attachments(data, ids) {
  let cache = data.params.rpc_cache.sandbox.attachments;

  if (!cache) {
    cache = data.params.rpc_cache.sandbox.attachments = {};
  }

  let attachments = {};
  let pending = [];

  _(ids).uniq().sort().forEach(function (id) {
    if (!cache.hasOwnProperty(id)) {
      pending.push(id);
      attachments[id] = null;
    } else {
      attachments[id] = cache[id];
    }
  });

  let result = data.params.rpc_cache.get('common.content.attachments', {
    ids: pending
  });

  if (result?.attachments) {
    pending.forEach(function (id) {
      attachments[id] = cache[id] = result.attachments[id];
    });
  }

  return attachments;
}


N.wire.once('init:parser', function attachment_plugin_init() {
  const sizes = '$$ JSON.stringify(N.config.users.uploads.resize) $$';

  N.parser.addPlugin(
    'attachment:fetch_attachment_info',
    function (parser) {
      parser.bus.on('ast2html', function fetch_attachment_data(data, callback) {
        if (!data.params.rpc_cache) {
          callback();
          return;
        }

        // find all images that point to an attachment and set data-nd-media-id attr
        data.ast.find('.image').each(function () {
          let $attach = $(this);
          let match = _.find(N.router.matchAll($attach.attr('src')), function (match) {
            return match.meta.methods.get === 'users.media';
          });

          if (!match) return;

          $attach.attr('data-nd-media-id', match.params.media_id);

          // Get a size from img alt attribute, e.g.:
          //  - ![md](link)
          //  - ![arbitrary text|md](link)
          //
          let alt = $attach.attr('alt') || '';
          let pos = alt.lastIndexOf('|');
          let size;

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

        // Fetch all images
        //
        let refs = [];

        data.ast.find('[data-nd-media-id]').map(function () {
          refs.push($(this).data('nd-media-id'));
        });

        let attachments = get_attachments(data, refs);

        data.ast.find('[data-nd-media-id]').each(function () {
          let $attach = $(this);
          let media_id = $attach.data('nd-media-id');

          // attachments[media_id] could be:
          //  - object { type, file_name } - if attachment exists
          //  - undefined - if attachment does not exist
          //  - null - if we don't have that information yet
          //
          if (attachments[media_id]) {
            $attach.data('nd-media-type', attachments[media_id].type);
            $attach.data('nd-media-filename', attachments[media_id].file_name);
          } else if (attachments[media_id] === null) {
            $attach.data('nd-media-placeholder', true);
          }
        });

        callback();
      });
    }
  );

  N.parser.addPlugin(
    'attachment',
    require('nodeca.core/lib/parser/plugins/attachment')(N, {
      types: '$$ JSON.stringify(N.models.users.MediaInfo.types) $$'
    })
  );
});
