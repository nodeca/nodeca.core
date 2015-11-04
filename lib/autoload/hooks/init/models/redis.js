// Init redis connection and store it in `N.redis`
//


'use strict';

var redis = require('redis');


module.exports = function (N) {

  N.wire.before('init:models', function redis_init(N, callback) {
    var url = (N.config.database || {}).redis;

    if (!url) {
      callback('No redis config found (database.redis)');
      return;
    }

    N.logger.info('Connecting to redis');

    // Callback proxy, since Redis connection is event-driven
    //
    function next(err) {
      if (err) {
        callback('redis error: ' + String(err.message || err));
        return;
      }

      N.logger.info('redis connected');
      callback();
    }

    // disable offline mode to avoid memory leaks if redis is offline,
    // because redis client doesn't appear to have a timeout on a single query
    N.redis = redis.createClient(url, { enable_offline_queue: false });

    N.redis.once('error', next);
    N.redis.once('connect', function () {
      N.redis.removeListener('error', next);

      N.redis.on('error', function (err) {
        N.logger.error('redis error: %s', String(err.message || err));
      });

      N.redis.on('connect', function () {
        N.logger.info('redis reconnected');
      });

      next();
    });
  });
};
