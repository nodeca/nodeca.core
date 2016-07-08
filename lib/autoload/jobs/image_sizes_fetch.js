// Download metadata for all images
//
'use strict';


const _        = require('lodash');
const Promise  = require('bluebird');
const co       = require('bluebird-co').co;
const get_size = require('probe-image-size');


module.exports = function (N) {
  N.wire.on('init:jobs', function register_image_sizes_fetch() {
    N.queue.registerWorker({
      name: 'image_sizes_fetch',

      // static id to make sure it will never be executed twice at the same time
      taskID() {
        return 'image_sizes_fetch';
      },

      timeout: 120000,

      // run 10 chunks in parallel, each of those retrieves 10 urls in parallel
      chunksPerInstance: 10,

      * map() {
        let runid = Date.now();

        yield N.models.core.ImageSizeCache.update(
          { status: N.models.core.ImageSizeCache.statuses.ERROR_RETRY },
          { $set: { status: N.models.core.ImageSizeCache.statuses.PENDING } },
          { multi: true }
        );

        let url_count = yield N.models.core.ImageSizeCache.count();

        let chunks = [];
        let urls_per_chunk = 100;
        let chunks_count = Math.ceil(url_count / urls_per_chunk);

        for (let i = 0; i < chunks_count; i++) {
          chunks.push({
            from:  i / chunks_count,
            to:    (i + 1) / chunks_count,
            runid
          });
        }

        return chunks;
      },

      * process() {
        const extendDeadline = _.throttle(() => this.setDeadline(), 10000);
        const statuses       = N.models.core.ImageSizeCache.statuses;

        let url_sizes = yield N.models.core.ImageSizeCache
                                 .where('rand').gte(this.data.from)
                                 .where('rand').lte(this.data.to)
                                 .where('status').equals(statuses.PENDING)
                                 .lean(true);

        yield Promise.map(url_sizes, co.wrap(function* (u) {
          extendDeadline();

          let url = u.url;
          let cache = { url: u.url, rand: u.rand };
          let result;
          let err;

          try {
            result = yield get_size(url);
          } catch (_err) {
            err = _err;
          }

          if (err) {
            let url_failed   = (err.code === 'ECONTENT') ||
                               (err.status && err.status >= 400 && err.status < 500);

            cache.status     = url_failed ? statuses.ERROR_FATAL : statuses.ERROR_RETRY;
            cache.error      = err.message;
            cache.error_code = err.status || err.code;
          } else {
            cache.status     = statuses.SUCCESS;

            cache.value      = {
              width:  result.width,
              wUnits: result.wUnits,
              height: result.height,
              hUnits: result.hUnits,
              length: result.length
            };
          }

          // Replace old object with the new one to reset any previously
          // fetched results (i.e. error status codes). Use native method
          // to avoid auto-$set.
          //
          yield N.models.core.ImageSizeCache.collection.update(
            { url },
            cache,
            { upsert: true }
          );
        }), { concurrency: 10 });

        //
        // Send stat update to client
        //

        let data = yield this.task.worker.status(this.task.id);

        if (data) {
          let task_info = {
            current: data.chunks.done + data.chunks.errored,
            total:   data.chunks.done + data.chunks.errored +
                     data.chunks.active + data.chunks.pending,
            runid:   this.data.runid
          };

          N.live.debounce('admin.core.rebuild.image_sizes_fetch', task_info);
        }

        return this.data.runid;
      },

      reduce(chunksResult) {
        var task_info = {
          current: 1,
          total:   1,
          runid:   chunksResult[0] || 0
        };

        N.live.emit('admin.core.rebuild.image_sizes_fetch', task_info);
      }
    });
  });
};
