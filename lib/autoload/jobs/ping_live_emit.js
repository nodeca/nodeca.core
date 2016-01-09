// Flush view counters from `forum.topic:views` in redis
// to `Topic.views_count` in mongo.
//
'use strict';


module.exports = function (N) {

  N.wire.after('init:server', function register_topic_views_update() {
    var task_name = 'ping_live_emit';

    if (!N.config.cron || !N.config.cron[task_name]) {
      return new Error(`No config defined for cron task '${task_name}'`);
    }

    N.queue.registerWorker({
      name: task_name,
      taskID: () => task_name,
      cron: N.config.cron[task_name],
      process: function (callback) {
        N.live.emit('admin.ping', {});
        callback();
      }
    });
  });
};
