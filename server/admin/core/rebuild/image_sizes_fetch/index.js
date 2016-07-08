// Add a widget displaying image meta fetch progress
//

'use strict';


module.exports = function (N) {
  N.wire.after('server:admin.core.rebuild', { priority: 90 }, function* image_sizes_fetch_widget(env) {
    let data = yield N.queue.worker('image_sizes_fetch').status();

    let task_info = {};

    if (data && data.state === 'aggregating') {
      task_info.current = data.chunks.done + data.chunks.errored;
      task_info.total   = data.chunks.done + data.chunks.errored +
                          data.chunks.active + data.chunks.pending;
    }

    env.res.blocks.push({ name: 'image_sizes_fetch', task_info });
  });
};
