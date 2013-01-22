// 1. Starts redis server, save as `N.runtime.redis`
// 2. Starts redback, save as `N.runtime.redback`
//


"use strict";


var Redis   = require('redis');
var Redback = require('redback');


////////////////////////////////////////////////////////////////////////////////


module.exports = function (N) {

  N.wire.before("init:models", function redis_init(N, callback) {
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
        callback("Redis error:" + String(err.message || err));
        return;
      }

      N.logger.info('Redis connected');
      callback();
    }

    N.runtime.redis = Redis.createClient(config.port, config.host);

    N.runtime.redis.once('error', next);
    N.runtime.redis.once('connect', function () {
      N.runtime.redis.removeListener('error', next);

      // bind Redback library with advanced tools
      N.runtime.redback = Redback.use(exports.client);

      if (!config.index) {
        next();
        return;
      }

      // Select Redis DB index, if defined. Probably, will be removed.
      N.runtime.redis.send_command('SELECT', [config.index], next);
    });
  });
};
