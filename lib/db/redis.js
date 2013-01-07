"use strict";


/*global N*/


// 3rd-party
var Redis   = require('redis');
var Redback = require('redback');


////////////////////////////////////////////////////////////////////////////////


// will be available after init
exports.client = null;


// redback will be available after init on success connect
exports.redback = null;


// 1. Starts redis server
// 2. Starts redback
//
exports.init = function (callback) {
  var client, config = (N.config.database || {}).redis;

  if (!config) {
    callback('No Redis configuration found');
    return;
  }

  function _callback(err) {
    callback(err ? String(err.message || err) : null);
  }

  exports.client = Redis.createClient(config.port, config.host);

  exports.client.once('error', _callback);
  exports.client.once('connect', function () {
    exports.client.removeListener('error', _callback);

    // bind Redback library with avvanced tools
    exports.redback = Redback.use(exports.client);

    if (!config.index) {
      _callback();
      return;
    }

    // Select Redis DB index, if defined. Probably, will be removed.
    exports.client.send_command('SELECT', [config.index], _callback);
  });
};
