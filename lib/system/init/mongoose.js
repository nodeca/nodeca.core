"use strict";


/*global N*/


// 3rd-party
var Mongoose = require('mongoose');


////////////////////////////////////////////////////////////////////////////////


// starts mongoose server and stores it as `N.runtime.mongoose`
//
N.hooks.init.after('application', function (callback) {
  var config = (N.config.database || {}).mongo, uri = 'mongodb://';

  if (!config) {
    callback('No MongoDB configuration found');
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
  Mongoose.connect(uri, callback);
});
