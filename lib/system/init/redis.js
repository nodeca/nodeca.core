// 1. Starts redis server, save as `N.runtime.redis`
// 2. Starts redback, save as `N.runtime.redback`
//


"use strict";


/*global N*/


// 3rd-party
var Redis   = require('redis');
var Redback = require('redback');


// internal
var stopwatch = require("./utils/stopwatch");


////////////////////////////////////////////////////////////////////////////////


module.exports = function (callback) {
  var timer = stopwatch();

  N.hooks.init.run("redis", function (next) {
    var config = (N.config.database || {}).redis;

    if (!config) {
      next('No Redis configuration found');
      return;
    }

    function _next(err) {
      next(err ? String(err.message || err) : null);
    }

    N.runtime.redis = Redis.createClient(config.port, config.host);

    N.runtime.redis.once('error', _next);
    N.runtime.redis.once('connect', function () {
      N.runtime.redis.removeListener('error', _next);

      // bind Redback library with advanced tools
      N.runtime.redback = Redback.use(exports.client);

      if (!config.index) {
        _next();
        return;
      }

      // Select Redis DB index, if defined. Probably, will be removed.
      N.runtime.redis.send_command('SELECT', [config.index], _next);
    });
  }, function (err) {
    if (err) {
      callback(err);
      return;
    }

    N.logger.info('Finish redis/redback init ' + timer.elapsed);
    callback();
  });
};
