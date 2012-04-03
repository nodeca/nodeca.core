"use strict";


/*global nodeca*/


// 3rd-party
var Redis = require('redis');


module.exports = function (next) {
  var cfg = (nodeca.config.database || {}).redis;

  if (!cfg) {
    next('No Redis configuration found');
    return;
  }

  nodeca.runtime.redis = Redis.createClient(cfg.port, cfg.host);

  nodeca.runtime.redis.once('error', next);
  nodeca.runtime.redis.once('connect', function () {
    nodeca.runtime.redis.removeListener('error', next);

    if (!cfg.index) {
      next();
      return;
    }

    nodeca.runtime.redis.send_command('SELECT', [cfg.index], function (err) {
      next(err);
    });
  });
};
