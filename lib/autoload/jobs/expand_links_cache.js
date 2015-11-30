// Build cache for all previously collected urls
//
'use strict';


module.exports = function (N) {
  N.wire.on('init:jobs', function register_expand_links_cache() {
    N.queue.registerWorker({
      name: 'expand_links_cache',

      // static id to make sure it will never be executed twice at the same time
      taskID: function () {
        return 'expand_links_cache';
      },

      chunksPerInstance: 1,

      map: function (callback) {
        var runid = Date.now();

        callback(null, [ { runid: runid } ]);
      },

      process: function (callback) {
        var self = this;

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
