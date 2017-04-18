// Build cache for all previously collected urls
//
'use strict';

const _           = require('lodash');
const Promise     = require('bluebird');
const Queue       = require('idoit');


module.exports = function (N) {

  N.wire.on('init:jobs', function register_expand_links_cache() {
    // Mapper
    //
    N.queue.registerTask({
      name: 'expand_links_cache',
      baseClass: Queue.ChainTemplate,
      pool: 'hard',
      taskID: () => 'expand_links_cache',
      init: Promise.coroutine(function* () {
        let runid = Date.now();

        yield N.models.core.UrlTracker.update(
          { status: N.models.core.UrlTracker.statuses.ERROR_RETRY },
          { $set: { status: N.models.core.UrlTracker.statuses.PENDING } },
          { multi: true }
        );

        let url_count = yield N.models.core.UrlTracker.count();

        let chunks = [];
        let urls_per_chunk = 100;
        let chunks_count = Math.ceil(url_count / urls_per_chunk);

        for (let i = 0; i < chunks_count; i++) {
          chunks.push(N.queue.expand_links_cache_chunk(
            i / chunks_count,
            (i + 1) / chunks_count,
            runid
          ));
        }

        let tasks = [];

        if (chunks.length) {
          tasks.push(N.queue.group(chunks));
        }

        tasks.push(N.queue.expand_links_cache_reduce());

        return tasks;
      })
    });


    // Chunk
    //
    N.queue.registerTask({
      name: 'expand_links_cache_chunk',
      pool: 'hard',
      timeout: 120000,
      removeDelay: 3600,
      process: Promise.coroutine(function* (from, to, runid) {
        const extendDeadline = _.throttle(() => this.setDeadline(120000), 10000);

        let urls = yield N.models.core.UrlTracker
          .where('rand').gte(from)
          .where('rand').lte(to)
          .where('status').equals(N.models.core.UrlTracker.statuses.PENDING)
          .lean(true);

        yield Promise.map(urls, u => {
          extendDeadline();

          return N.wire.emit('internal:common.embed', { url: u.url, types: [ 'block', 'inline' ] });
        }, { concurrency: 10 });

        //
        // Send stat update to client
        //

        let task = yield N.queue.getTask('expand_links_cache');

        if (task) {
          let task_info = {
            current: task.progress,
            total:   task.total,
            runid
          };

          N.live.debounce('admin.core.rebuild.expand_links_cache', task_info);
        }

        return runid;
      })
    });


    // Reducer
    //
    N.queue.registerTask('expand_links_cache_reduce', chunksResult => {
      let task_info = {
        current: 1,
        total:   1,
        runid:   chunksResult[0] || 0
      };

      N.live.emit('admin.core.rebuild.expand_links_cache', task_info);
    });
  });
};
