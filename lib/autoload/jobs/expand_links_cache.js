// Build cache for all previously collected urls
//
'use strict';

const _           = require('lodash');
const Promise     = require('bluebird');
const Embedza     = require('embedza');
const embedza_pkg = require('embedza/package.json');
const Unshort     = require('url-unshort');
const unshort_pkg = require('url-unshort/package.json');
const Queue       = require('idoit');


module.exports = function (N) {

  let rootUrl = _.get(N.config, 'bind.default.mount', 'http://localhost') + '/';
  let userAgentUnshort = `${unshort_pkg.name}/${embedza_pkg.version} (Nodeca; +${rootUrl})`;
  let userAgentEmbedza = `${embedza_pkg.name}/${embedza_pkg.version} (Nodeca; +${rootUrl})`;

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

        if (chunks.length) {
          this.__children__.push(N.queue.group(chunks));
        }

        this.__children__.push(N.queue.expand_links_cache_reduce());
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
        const statuses       = N.models.core.UrlTracker.statuses;

        let unshort = new Unshort({
          cache: {
            get: N.models.core.UnshortCache.get.bind(N.models.core.UnshortCache),
            set: N.models.core.UnshortCache.set.bind(N.models.core.UnshortCache)
          },
          request: {
            headers: {
              'user-agent': userAgentUnshort
            }
          }
        });

        let embedza = new Embedza({
          cache: {
            get: N.models.core.EmbedzaCache.get.bind(N.models.core.EmbedzaCache),
            set: N.models.core.EmbedzaCache.set.bind(N.models.core.EmbedzaCache)
          },
          enabledProviders: N.config.embed.enabled,
          request: {
            headers: {
              'user-agent': userAgentEmbedza
            }
          }
        });

        let urls = yield N.models.core.UrlTracker
          .where('rand').gte(from)
          .where('rand').lte(to)
          .where('status').equals(statuses.PENDING)
          .lean(true);

        yield Promise.map(urls, Promise.coroutine(function* (u) {
          extendDeadline();

          let unshort_res;
          let embedza_res;

          let tracker = {
            url: u.url,
            rand: u.rand,
            retries: (u.retries || 0) + 1
          };

          try {
            unshort_res = yield unshort.expand(u.url);
            embedza_res = yield embedza.render(u.url, [ 'block', 'inline' ]);

            tracker.status       = statuses.SUCCESS;
            tracker.uses_unshort = !!unshort_res;
            tracker.uses_embedza = !!embedza_res;
          } catch (err) {
            // retry all errors except:
            //  - 5xx - server-side errors
            //  - 429 - rate limit
            //  - 408 - request timeout
            //  - EINVAL - bad urls like http://1234
            let is_fatal = err.statusCode && !String(+err.statusCode).match(/^(5..|429|408)$/) ||
                           err.code === 'EINVAL';

            tracker.status     = is_fatal ? statuses.ERROR_FATAL : statuses.ERROR_RETRY;
            tracker.error      = err.message;
            tracker.error_code = err.statusCode || err.code;
          }

          // Replace old object with the new one to reset any previously
          // fetched results (i.e. error status codes). Use native method
          // to avoid auto-$set.
          //
          yield N.models.core.UrlTracker.collection.update(
            { url: u.url },
            tracker,
            { upsert: true }
          );
        }), { concurrency: 10 });

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
