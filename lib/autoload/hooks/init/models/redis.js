// Init redis connection and store it in `N.redis`
//


'use strict';


var Redis   = require('redis');


////////////////////////////////////////////////////////////////////////////////


module.exports = function (N) {

  N.wire.before('init:models', function redis_init(N, callback) {
    var config = (N.config.database || {}).redis;

    if (!config) {
      callback('No Redis configuration found');
      return;
    }

    N.logger.info('Connecting to Redis');

    // Callback proxy, since Redis connection is event-driven
    //
    function next(err) {
      if (err) {
        callback('Redis error: ' + String(err.message || err));
        return;
      }

      N.logger.info('Redis connected');
      callback();
    }

    N.redis = Redis.createClient(config.port, config.host);

    N.redis.once('error', next);
    N.redis.once('connect', function () {
      N.redis.removeListener('error', next);

      if (!config.index) {
        next();
        return;
      }

      // Select Redis DB index, if defined. Probably, will be removed.
      N.redis.send_command('SELECT', [ config.index ], next);
    });
  });
};
