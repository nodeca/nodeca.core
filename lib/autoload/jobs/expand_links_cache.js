// Build cache for all previously collected urls
//
'use strict';

const Embedza = require('embedza');
const thenify = require('thenify');
const Unshort = require('url-unshort');


module.exports = function (N) {
  N.wire.on('init:jobs', function register_expand_links_cache() {
    N.queue.registerWorker({
      name: 'expand_links_cache',

      // static id to make sure it will never be executed twice at the same time
      taskID() {
        return 'expand_links_cache';
      },

      // run 10 chunks in parallel, each of those retrieves urls sequentially
      chunksPerInstance: 10,

      * map() {
        let runid = Date.now();

        yield N.models.core.ExpandUrl.update(
          { status: N.models.core.ExpandUrl.statuses.ERROR_RETRY },
          { $set: { status: N.models.core.ExpandUrl.statuses.PENDING } },
          { multi: true }
        );

        let url_count = yield N.models.core.ExpandUrl.count();

        let chunks = [];
        let urls_per_chunk = 100;
        let chunks_count = Math.round(url_count / urls_per_chunk);

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
        let unshort = new Unshort({
          cache: {
            get: N.models.core.UnshortCache.get.bind(N.models.core.UnshortCache),
            set: N.models.core.UnshortCache.set.bind(N.models.core.UnshortCache)
          }
        });

        let embedza = new Embedza({
          cache: {
            get: N.models.core.EmbedzaCache.get.bind(N.models.core.EmbedzaCache),
            set: N.models.core.EmbedzaCache.set.bind(N.models.core.EmbedzaCache)
          },
          enabledProviders: N.config.embed.enabled
        });

        let unshort_expand = thenify(unshort.expand.bind(unshort));
        let embedza_render = thenify(embedza.render.bind(embedza));

        let urls = yield N.models.core.ExpandUrl
                            .where('rand').gte(this.data.from)
                            .where('rand').lte(this.data.to)
                            .where('status').equals(N.models.core.ExpandUrl.statuses.PENDING)
                            .lean(true);

        for (let i = 0; i < urls.length; i++) {
          let u = urls[i];
          let unshort_res, embedza_res;

          try {
            unshort_res = yield unshort_expand(u.url);
            embedza_res = yield embedza_render(u.url, [ 'block', 'inline' ]);

            yield N.models.core.ExpandUrl.update({ url: u.url }, { $set: {
              status: N.models.core.ExpandUrl.statuses.SUCCESS,
              uses_unshort: !!unshort_res,
              uses_embedza: !!embedza_res
            } });
          } catch (err) {
            let is_fatal = err.code === 'EHTTP' &&
                           [ 401, 403, 404 ].indexOf(err.status) !== -1;

            yield N.models.core.ExpandUrl.update({ url: u.url }, { $set: {
              status: N.models.core.ExpandUrl.statuses[is_fatal ? 'ERROR_FATAL' : 'ERROR_RETRY'],
              error: err.message
            } });
          }
        }

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

          N.live.debounce('admin.core.rebuild.expand_links_cache', task_info);
        }

        return this.data.runid;
      },

      reduce(chunksResult) {
        var task_info = {
          current: 1,
          total:   1,
          runid:   chunksResult[0] || 0
        };

        N.live.emit('admin.core.rebuild.expand_links_cache', task_info);
      }
    });
  });
};
