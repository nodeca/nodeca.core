// Cleanup old markers
//
'use strict';


var util = require('util');


module.exports = function (N) {
  N.wire.on('init:jobs', function register_markers_cleanup() {
    var task_name = 'markers_cleanup';

    if (!N.config.cron || !N.config.cron[task_name]) {
      return new Error(util.format('No config defined for cron task "%s"', task_name));
    }

    N.queue.registerWorker({
      name: task_name,
      cron: N.config.cron[task_name],
      process: function (__, callback) {
        N.models.core.Marker.cleanup(function (err) {
          if (err) {
            // don't return an error in the callback because we don't need automatic reloading
            N.logger.error('"%s" job error: %s', task_name, err.message || err);
          }

          callback();
        });
      }
    });
  });
};
