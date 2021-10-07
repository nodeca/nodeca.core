// Remove old files from tmpfs
//
'use strict';


module.exports = function (N) {

  N.wire.on('init:jobs', function register_filetmp_cleanup() {
    const task_name = 'filetmp_cleanup';

    if (!N.config.cron || !N.config.cron[task_name]) {
      return new Error(`No config defined for cron task "${task_name}"`);
    }

    N.queue.registerTask({
      name: task_name,
      pool: 'hard',
      cron: N.config.cron[task_name],
      async process() {
        await N.models.core.FileTmp.gc();
      }
    });
  });
};
