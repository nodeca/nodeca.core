// Add a widget displaying link cache build progress
//

'use strict';


module.exports = function (N) {
  N.wire.after('server:admin.core.rebuild', { priority: 40 }, function expand_links_cache_widget(env, callback) {
    N.queue.status('queue:expand_links_cache:expand_links_cache', function (err, data) {
      if (err) {
        callback(err);
        return;
      }

      var task_info = {};

      if (data && data.state === 'aggregating') {
        task_info.current = data.chunks.done.length + data.chunks.errored.length;
        task_info.total   = data.chunks.done.length + data.chunks.errored.length +
                            data.chunks.active.length + data.chunks.pending.length;
      }

      env.res.blocks.push({
        name:      'expand_links_cache',
        task_info: task_info
      });

      callback();
    });
  });
};
