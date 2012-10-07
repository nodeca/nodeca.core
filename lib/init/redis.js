"use strict";


/*global nodeca*/


// 3rd-party
var Redis = require('redis');


////////////////////////////////////////////////////////////////////////////////


// starts redis server and stores it as `nodeca.components.redis`
//
module.exports = function (next) {
  var cfg = (nodeca.config.database || {}).redis;

  if (!cfg) {
    next('No Redis configuration found');
    return;
  }

  function on_error(err) {
    next(err.message || err.toString());
  }

  nodeca.components.redis = Redis.createClient(cfg.port, cfg.host);

  nodeca.components.redis.once('error', on_error);
  nodeca.components.redis.once('connect', function () {
    nodeca.components.redis.removeListener('error', on_error);

    if (!cfg.index) {
      next();
      return;
    }

    nodeca.components.redis.send_command('SELECT', [cfg.index], function (err) {
      if (err) {
        on_error(err);
        return;
      }

      next();
    });
  });
};
