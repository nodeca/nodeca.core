"use strict";


/*global nodeca*/


// 3rd-party
var Mongoose = require('mongoose');


////////////////////////////////////////////////////////////////////////////////


// starts mongoose server and stores it as `nodeca.components.mongoose`
//
module.exports = function (next) {
  var cfg = (nodeca.config.database || {}).mongo, uri = 'mongodb://';

  if (!cfg) {
    next('No MongoDB configuration found');
    return;
  }

  // build mongodb connection uri
  if (cfg.user) {
    uri += cfg.user;

    if (cfg.pass) {
      uri += ':' + cfg.pass;
    }

    uri += '@';
  }

  uri += cfg.host;

  if (cfg.port) {
    uri += ':' + cfg.port;
  }

  uri += '/' + cfg.database;

  // connect to database
  nodeca.components.mongoose = Mongoose;
  Mongoose.connect(uri, next);
};
