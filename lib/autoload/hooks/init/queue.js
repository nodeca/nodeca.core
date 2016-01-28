// Expose queue to `N.queue`, register available jobs
//

'use strict';


var _     = require('lodash');
var Queue = require('nodeca.core/lib/queue');


module.exports = function (N) {

  N.wire.after('init:models', function queue_init(env) {

    var lossy_logger = _.throttle(function (err) {
      N.logger.error(err);
    }, 10000);

    N.queue = new Queue(N.redis);

    // Log critical errors, here we shouldn't log chunk's errors
    N.queue.on('error', function (err) {
      if (err instanceof Queue.Error || N.redis.connected) {
        // Log all errors if:
        //  1. it's a queue own error
        //  2. redis is connected (probably a command syntax error)
        N.logger.error(err);
      } else {
        // If redis is not connected, this is likely a connection error,
        // so throttle those to avoid logs blowing up.
        lossy_logger(err);
      }
    });

    N.wire.on('init:server.queue', function queue_start() {
      N.queue.start();
    });

    return N.wire.emit('init:jobs', env);
  });
};
