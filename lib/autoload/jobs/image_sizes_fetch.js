// Download metadata for all images
//
'use strict';


const _            = require('lodash');
const Promise      = require('bluebird');
const get_size     = require('probe-image-size');
const get_size_pkg = require('probe-image-size/package.json');
const Queue        = require('idoit');


module.exports = function (N) {

  let rootUrl = _.get(N.config, 'bind.default.mount', 'http://localhost') + '/';
  let userAgent = `${get_size_pkg.name}/${get_size_pkg.version} (Nodeca; +${rootUrl})`;

  N.wire.on('init:jobs', function register_image_sizes_fetch() {
    // Mapper
    //
    N.queue.registerTask({
      name: 'image_sizes_fetch',
      pool: 'hard',
      baseClass: Queue.ChainTemplate,
      taskID: () => 'image_sizes_fetch',
      init: Promise.coroutine(function* () {
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
          chunks.push(N.queue.image_sizes_fetch_chunk(
            i / chunks_count,
            (i + 1) / chunks_count,
            runid
          ));
        }

        if (chunks.length) {
          this.__children__.push(N.queue.group(chunks));
        }

        this.__children__.push(N.queue.image_sizes_fetch_reduce());
      })
    });


    // Chunk
    //
    N.queue.registerTask({
      name: 'image_sizes_fetch_chunk',
      pool: 'hard',
      timeout: 120000,
      removeDelay: 3600,
      process: Promise.coroutine(function* (from, to, runid) {
        const extendDeadline = _.throttle(() => this.setDeadline(120000), 10000);
        const statuses       = N.models.core.ImageSizeCache.statuses;

        let url_sizes = yield N.models.core.ImageSizeCache
                                  .where('rand').gte(from)
                                  .where('rand').lte(to)
                                  .where('status').equals(statuses.PENDING)
                                  .lean(true);

        yield Promise.map(url_sizes, Promise.coroutine(function* (u) {
          extendDeadline();

          let url = u.url;
          let result;
          let err;

          let cache = {
            url: u.url,
            rand: u.rand,
            retries: (u.retries || 0) + 1
          };

          try {
            result = yield get_size(url, { headers: { 'user-agent': userAgent } });
          } catch (_err) {
            err = _err;
          }

          if (err) {
            // retry all errors except:
            //  - 5xx - server-side errors
            //  - 429 - rate limit
            //  - 408 - request timeout
            //  - EINVAL - bad urls like http://1234
            //  - ECONTENT - probe error: not a picture
            let is_fatal = err.statusCode && !String(+err.statusCode).match(/^(5..|429|408)$/) ||
                           err.code === 'EINVAL' ||
                           err.code === 'ECONTENT';

            cache.status     = is_fatal ? statuses.ERROR_FATAL : statuses.ERROR_RETRY;
            cache.error      = err.message;
            cache.error_code = err.statusCode || err.code;
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

        let task = yield N.queue.getTask('image_sizes_fetch');

        if (task) {
          let task_info = {
            current: task.progress,
            total:   task.total,
            runid
          };

          N.live.debounce('admin.core.rebuild.image_sizes_fetch', task_info);
        }

        return runid;
      })
    });


    // Reducer
    //
    N.queue.registerTask('image_sizes_fetch_reduce', chunksResult => {
      let task_info = {
        current: 1,
        total:   1,
        runid:   chunksResult[0] || 0
      };

      N.live.emit('admin.core.rebuild.image_sizes_fetch', task_info);
    });
  });
};
