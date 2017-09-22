// Initialize queue client, expose to `N.queue` and register available tasks
//
'use strict';


const Queue = require('idoit');
const _     = require('lodash');


module.exports = function (N) {
  N.wire.after('init:models', async function queue_init(N) {
    let lossy_logger = _.throttle(err => N.logger.error(err), 10000);

    N.queue = new Queue({ redisURL: N.config.database.redis });

    // Log critical errors, here we shouldn't log chunk's errors
    N.queue.on('error', function (err) {
      if (err instanceof Queue.Error || N.redis.connected) {
        // Log all errors if:
        //  1. it's a queue own error
        //  2. redis is connected (probably a command syntax error)
        if (err.code !== 'CANCELED') {
          N.logger.error(err);
        }
      } else {
        // If redis is not connected, this is likely a connection error,
        // so throttle those to avoid logs blowing up.
        lossy_logger(err);
      }
    });

    N.wire.once('exit.shutdown', { ensure: true, parallel: true }, function close_queue() {
      return N.queue.shutdown();
    });

    await N.wire.emit('init:jobs', N);
  });
};
