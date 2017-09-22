
'use strict';


const _  = require('lodash');
const $  = require('nodeca.core/lib/parser/cheequery');


module.exports = function (N) {
  N.wire.once('init:parser', function attachment_plugin_init() {
    const sizes = N.config.users.uploads.resize;

    N.parser.addPlugin(
      'attachment:fetch_attachment_info',
      function (parser) {
        parser.bus.on('ast2html', async function fetch_attachment_data(data) {
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

          // Fetch all images and calculate attach tail
          //
          let refs = [];

          data.ast.find('[data-nd-media-id]').map(function () {
            refs.push([ $(this).data('nd-media-id'), $(this).data('nd-media-size') ]);
          });

          let tail_refs = data.params.attachments.filter(function (media_id) {
            return !_.find(refs, r => r[0] === String(media_id));
          }).map(function (id) {
            return [ id, 'sm' ];
          });

          refs = refs.concat(tail_refs);

          let attach_list = {
            ids: _.sortedUniq(refs.map(r => r[0]).sort())
          };

          await N.wire.emit('internal:common.content.attachments', attach_list);

          data.ast.find('[data-nd-media-id]').each(function () {
            let $attach = $(this);
            let id = $attach.data('nd-media-id');
            let size = $attach.data('nd-media-size');
            let attach_meta = attach_list.attachments[id];
            let image_size;

            if (!attach_meta) return;

            if (attach_meta.image_sizes && attach_meta.image_sizes[size]) {
              image_size = attach_meta.image_sizes[size];
            }

            $attach.data('nd-media-type',     attach_meta.type);
            $attach.data('nd-media-filename', attach_meta.file_name);

            if (image_size) {
              $attach.data('nd-width',  image_size.width);
              $attach.data('nd-height', image_size.height);

              // for consistency, to have the same data as in external images; unused
              $attach.data('nd-wunits', 'px');
              $attach.data('nd-hunits', 'px');
            }
          });

          data.result.tail = tail_refs.map(function (ref) {
            let id = ref[0];
            let attach_meta = attach_list.attachments[id];

            if (!attach_meta) return null;

            return _.omitBy({
              media_id:  id,
              type:      attach_meta.type,
              file_name: attach_meta.file_name
            }, _.isUndefined);
          }).filter(Boolean);
        });
      }
    );

    N.parser.addPlugin(
      'attachment',
      require('nodeca.core/lib/parser/plugins/attachment')(N, {
        types: N.models.users.MediaInfo.types
      })
    );
  });
};
