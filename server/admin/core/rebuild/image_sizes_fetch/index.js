// Add a widget displaying image meta fetch progress
//

'use strict';


module.exports = function (N) {
  N.wire.after('server:admin.core.rebuild', { priority: 90 }, function* image_sizes_fetch_widget(env) {
    let task = yield N.queue.getTask('image_sizes_fetch');
    let task_info = {};

    if (task && task.state !== 'finished') {
      task_info = {
        current: task.progress,
        total:   task.total
      };
    }

    env.res.blocks.push({ name: 'image_sizes_fetch', task_info });
  });
};
