// starts mongoose server and stores it as `N.runtime.mongoose`
//


"use strict";


// 3rd-party
var Mongoose = require('mongoose');


// internal
var stopwatch = require("./utils/stopwatch");


////////////////////////////////////////////////////////////////////////////////


module.exports = function (N, callback) {
  var timer = stopwatch();

  N.hooks.init.run("mongoose", function (next) {
    var config = (N.config.database || {}).mongo, uri = 'mongodb://';

    if (!config) {
      next('No MongoDB configuration found');
      return;
    }

    // build mongodb connection uri
    if (config.user) {
      uri += config.user;

      if (config.pass) {
        uri += ':' + config.pass;
      }

      uri += '@';
    }

    uri += config.host;

    if (config.port) {
      uri += ':' + config.port;
    }

    uri += '/' + config.database;

    // connect to database
    N.runtime.mongoose = Mongoose;
    Mongoose.connect(uri, next);
  }, function (err) {
    if (err) {
      callback(err);
      return;
    }

    N.logger.info('Finish mongoose init ' + timer.elapsed);
    callback();
  });
};
