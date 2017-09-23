// Add a widget displaying link cache build progress
//

'use strict';


module.exports = function (N) {
  N.wire.after('server:admin.core.rebuild', { priority: 80 }, async function expand_links_cache_widget(env) {
    let task = await N.queue.getTask('expand_links_cache');
    let task_info = {};

    if (task && task.state !== 'finished') {
      task_info = {
        current: task.progress,
        total:   task.total
      };
    }

    env.res.blocks.push({ name: 'expand_links_cache', task_info });
  });
};
