// Init redis connection and store it in `N.redis`
//


'use strict';


var Redis   = require('redis');


////////////////////////////////////////////////////////////////////////////////


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

    N.redis = require('redis-url').connect(url);

    N.redis.once('error', next);
    N.redis.once('connect', function () {
      N.redis.removeListener('error', next);
      next();
    });
  });
};
