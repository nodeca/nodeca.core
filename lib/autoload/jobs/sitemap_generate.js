// Generate sitemap
//
'use strict';


module.exports = function (N) {
  N.wire.on('init:jobs', function sitemap_generate() {
    const task_name = 'sitemap_generate';

    if (!N.config.cron || !N.config.cron[task_name]) {
      return new Error(`No config defined for cron task "${task_name}"`);
    }

    N.queue.registerTask({
      name: task_name,
      pool: 'hard',
      cron: N.config.cron[task_name],
      timeout: 300000, // 5 min
      process() {
        return N.wire.emit('internal:common.sitemap.generate');
      }
    });
  });
};
