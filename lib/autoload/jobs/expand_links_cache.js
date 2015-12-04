// Build cache for all previously collected urls
//
'use strict';

var async   = require('async');
var Embedza = require('embedza');
var Unshort = require('url-unshort');


module.exports = function (N) {
  function set_error(url, error, callback) {
    var is_fatal = error.message.match(/Bad response code: (?:401|403|404)/);

    N.models.core.ExpandUrl.update({ url: url }, { $set: {
      status: N.models.core.ExpandUrl.statuses[is_fatal ? 'ERROR_FATAL' : 'ERROR_RETRY'],
      error: error.message
    } }, callback);
  }

  N.wire.on('init:jobs', function register_expand_links_cache() {
    N.queue.registerWorker({
      name: 'expand_links_cache',

      // static id to make sure it will never be executed twice at the same time
      taskID: function () {
        return 'expand_links_cache';
      },

      // run 10 chunks in parallel, each of those retrieves urls sequentially
      chunksPerInstance: 10,

      map: function (callback) {
        var runid = Date.now();

        N.models.core.ExpandUrl.update(
            { status: N.models.core.ExpandUrl.statuses.ERROR_RETRY },
            { $set: { status: N.models.core.ExpandUrl.statuses.PENDING } },
            { multi: true },
            function (err) {

          if (err) {
            callback(err);
            return;
          }

          N.models.core.ExpandUrl.count(function (err, url_count) {
            if (err) {
              callback(err);
              return;
            }

            var chunks = [];
            var urls_per_chunk = 100;
            var chunks_count = Math.round(url_count / urls_per_chunk);

            for (var i = 0; i < chunks_count; i++) {
              chunks.push({
                from:  i / chunks_count,
                to:    (i + 1) / chunks_count,
                runid: runid
              });
            }

            callback(null, chunks);
          });
        });
      },

      process: function (callback) {
        var self = this;

        var unshort = new Unshort({
          cache: {
            get: N.models.core.UnshortCache.get.bind(N.models.core.UnshortCache),
            set: N.models.core.UnshortCache.set.bind(N.models.core.UnshortCache)
          }
        });

        var embedza = new Embedza({
          cache: {
            get: N.models.core.EmbedzaCache.get.bind(N.models.core.EmbedzaCache),
            set: N.models.core.EmbedzaCache.set.bind(N.models.core.EmbedzaCache)
          },
          enabledProviders: N.config.embed.enabled
        });

        N.models.core.ExpandUrl
            .where('rand').gte(self.data.from)
            .where('rand').lte(self.data.to)
            .where('status').equals(N.models.core.ExpandUrl.statuses.PENDING)
            .lean(true)
            .exec(function (err, urls) {

          if (err) {
            callback(err);
            return;
          }

          async.eachSeries(urls, function (u, callback) {
            unshort.expand(u.url, function (err, unshort_res) {
              if (err) {
                set_error(u.url, err, callback);
                return;
              }

              embedza.render(u.url, [ 'block', 'inline' ], function (err, embedza_res) {
                if (err) {
                  set_error(u.url, err, callback);
                  return;
                }

                N.models.core.ExpandUrl.update({ url: u.url }, { $set: {
                  status: N.models.core.ExpandUrl.statuses.SUCCESS,
                  uses_unshort: !!unshort_res,
                  uses_embedza: !!embedza_res
                } }, callback);
              });
            });
          }, function (err) {
            if (err) {
              callback(err);
              return;
            }

            //
            // Send stat update to client
            //

            N.queue.status(self.task.id, function (err, data) {
              if (err) {
                callback(err);
                return;
              }

              if (!data) {
                // This should not happen, but required for safety
                callback(err);
                return;
              }

              var task_info = {
                current: data.chunks.done.length + data.chunks.errored.length,
                total:   data.chunks.done.length + data.chunks.errored.length +
                         data.chunks.active.length + data.chunks.pending.length,
                runid:   self.data.runid
              };

              N.live.debounce('admin.core.rebuild.expand_links_cache', task_info);

              callback(null, self.data.runid);
            });
          });
        });
      },

      reduce: function (chunksResult, callback) {
        var task_info = {
          current: 1,
          total:   1,
          runid:   chunksResult[0] || 0
        };

        N.live.emit('admin.core.rebuild.expand_links_cache', task_info);

        callback();
      }
    });
  });
};
