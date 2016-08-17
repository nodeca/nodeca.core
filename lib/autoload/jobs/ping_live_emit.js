'use strict';


const Promise = require('bluebird');


module.exports = function (N) {

  // it should be executed after faye
  N.wire.on('init:jobs', function register_ping_live_emit() {
    var task_name = 'ping_live_emit';

    if (!N.config.cron || !N.config.cron[task_name]) {
      return new Error(`No config defined for cron task '${task_name}'`);
    }

    N.queue.registerWorker({
      name:       task_name,
      taskID:     () => task_name,
      cron:       N.config.cron[task_name],
      track:      0,
      retryDelay: 3000,
      timeout:    2000,
      process() {
        N.live.emit('admin.ping');

        return Promise.delay(1000);
      }
    });
  });
};
