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

  function on_error(err) {
    next(err.message || err.toString());
  }

  nodeca.runtime.redis = Redis.createClient(cfg.port, cfg.host);

  nodeca.runtime.redis.once('error', on_error);
  nodeca.runtime.redis.once('connect', function () {
    nodeca.runtime.redis.removeListener('error', on_error);

    if (!cfg.index) {
      next();
      return;
    }

    nodeca.runtime.redis.send_command('SELECT', [cfg.index], function (err) {
      if (err) {
        on_error(err);
        return;
      }

      next();
    });
  });
};
