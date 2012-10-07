"use strict";


/*global nodeca*/


// 3rd-party
var Redis = require('redis');
var Redback = require('redback');


////////////////////////////////////////////////////////////////////////////////


// 1. Starts redis server and stores it as `nodeca.components.redis`
// 2. Add nice `redback` library to `nodeca.components.redback` 
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

    // bind Redback library with avvanced tools
    nodeca.components.redback = Redback.use(nodeca.components.redis);

    if (!cfg.index) {
      next();
      return;
    }

    // Select Redis DB index, if defined. Probably, will be removed.
    nodeca.components.redis.send_command('SELECT', [cfg.index], function (err) {
      if (err) {
        on_error(err);
        return;
      }

      next();
    });
  });
};
