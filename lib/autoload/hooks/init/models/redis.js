// Init redis connection and store it in `N.redis`
//


'use strict';


const redis    = require('redis');
const bluebird = require('bluebird');


// Promisify redis (https://github.com/NodeRedis/node_redis#promises)
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);


module.exports = function (N) {

  N.wire.before('init:models', function redis_init(N) {
    var url = (N.config.database || {}).redis;

    if (!url) throw 'No redis config found (database.redis)';

    N.logger.info('Connecting to redis');

    return new Promise((resolve, reject) => {
      // disable offline mode to avoid memory leaks if redis is offline,
      // because redis client doesn't appear to have a timeout on a single query
      N.redis = redis.createClient(url, { enable_offline_queue: false });

      N.redis.once('error', reject);
      N.redis.once('connect', () => {
        N.redis.removeListener('error', reject);

        N.redis.on('error', err =>
          N.logger.error('redis error: %s', String(err.message || err)));

        N.redis.on('connect', () => N.logger.info('redis reconnected'));

        resolve();
      });
    });
  });
};
