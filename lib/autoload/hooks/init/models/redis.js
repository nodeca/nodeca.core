// Init redis connection and store it in `N.redis`
//


'use strict';


const Redis    = require('ioredis');
const redisIf  = require('redis-if');


module.exports = function (N) {

  N.wire.before('init:models', function redis_init(N) {
    var url = N.config.database?.redis;

    if (!url) throw 'No redis config found (database.redis)';

    N.logger.info('Connecting to redis');

    return new Promise((resolve, reject) => {
      // disable offline mode to avoid memory leaks if redis is offline,
      // because redis client doesn't appear to have a timeout on a single query
      N.redis = new Redis(url, { enableOfflineQueue: false });

      // register script for conditional transactions;
      // it should replace all custom scripting and may be used in nodeca extensions
      N.redis.defineCommand('transaction', { lua: redisIf.script, numberOfKeys: 0 });

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
