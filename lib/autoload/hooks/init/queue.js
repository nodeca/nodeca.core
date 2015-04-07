// Expose queue to `N.queue`, register available jobs
//

'use strict';


var Queue = require('nodeca.core/lib/queue');


module.exports = function (N) {

  N.wire.after('init:models', function queue_init(env, callback) {

    N.queue = new Queue(N.redis);

    // Log critical errors, here we shouldn't log chunk's errors
    N.queue.on('error', function (err) {
      N.logger.error(err);
    });

    N.wire.emit('init:jobs', env, callback);
  });
};
