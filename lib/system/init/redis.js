"use strict";


/*global N*/


// 3rd-party
var Redis   = require('redis');
var Redback = require('redback');


////////////////////////////////////////////////////////////////////////////////


// 1. Starts redis server, save as `N.runtime.redis`
// 2. Starts redback, save as `N.runtime.redback`
//
N.hooks.init.after('application', function (callback) {
  var config = (N.config.database || {}).redis;

  if (!config) {
    callback('No Redis configuration found');
    return;
  }

  function _callback(err) {
    callback(err ? String(err.message || err) : null);
  }

  N.runtime.redis = Redis.createClient(config.port, config.host);

  N.runtime.redis.once('error', _callback);
  N.runtime.redis.once('connect', function () {
    N.runtime.redis.removeListener('error', _callback);

    // bind Redback library with advanced tools
    N.runtime.redback = Redback.use(exports.client);

    if (!config.index) {
      _callback();
      return;
    }

    // Select Redis DB index, if defined. Probably, will be removed.
    N.runtime.redis.send_command('SELECT', [config.index], _callback);
  });
});
