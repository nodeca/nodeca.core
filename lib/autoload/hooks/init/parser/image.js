
'use strict';


const _  = require('lodash');
const $  = require('nodeca.core/lib/parser/cheequery');


module.exports = function (N) {

  N.wire.once('init:parser', function image_plugin_init() {
    const plugin = require('nodeca.core/lib/parser/plugins/image')(N);

    N.parser.addPlugin(
      'image',
      function (parser) {
        // This hook needs to be executed after `fetch_attachment_data`, but before rendering
        // image. `after` works, because render is included later in this same file
        //
        parser.bus.after('ast2html', function* fetch_image_sizes(data) {
          let image_urls = [];

          data.ast.find('.image').each(function () {
            image_urls.push($(this).attr('src'));
          });

          image_urls = _.uniq(image_urls);

          let result = {};

          if (image_urls.length) {
            let statuses = N.models.core.ImageSizeCache.statuses;

            let cache = yield N.models.core.ImageSizeCache
                                  .where('url').in(image_urls)
                                  .lean(true);

            // fill in results
            for (let img of cache) {
              if (img.status !== statuses.SUCCESS) continue;

              result[img.url] = img.value;
            }

            // prepare image size records to fetch later
            let bulk = N.models.core.ImageSizeCache.collection.initializeUnorderedBulkOp();
            let count = 0;

            for (let url of image_urls) {
              if (result[url]) continue;

              count++;

              bulk.find({ url }).upsert().update({
                $setOnInsert: { url, status: statuses.PENDING, rand: Math.random() }
              });
            }

            if (count) yield bulk.execute();
          }


          data.ast.find('.image').each(function () {
            let $img = $(this);
            let info = result[$img.attr('src')];

            if (info && info.wUnits === info.hUnits) {
              $img.data('nd-width',  info.width);  // width factor
              $img.data('nd-height', info.height); // height factor
              $img.data('nd-wunits', info.wUnits); // width units (`px`, `em`, etc)
              $img.data('nd-hunits', info.hUnits); // height units (`px`, `em`, etc)
            }
          });
        });

        plugin(parser);
      }
    );
  });
};
