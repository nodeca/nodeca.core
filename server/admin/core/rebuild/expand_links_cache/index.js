// Add a widget displaying link cache build progress
//

'use strict';


module.exports = function (N) {
  N.wire.after('server:admin.core.rebuild', { priority: 40 }, function expand_links_cache_widget(env, callback) {
    N.queue.worker('expand_links_cache').status(function (err, data) {
      if (err) {
        callback(err);
        return;
      }

      var task_info = {};

      if (data && data.state === 'aggregating') {
        task_info.current = data.chunks.done + data.chunks.errored;
        task_info.total   = data.chunks.done + data.chunks.errored +
                            data.chunks.active + data.chunks.pending;
      }

      env.res.blocks.push({
        name:      'expand_links_cache',
        task_info: task_info
      });

      callback();
    });
  });
};
