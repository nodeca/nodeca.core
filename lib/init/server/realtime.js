"use strict";


/*global nodeca, _*/


// 3rd-party
var Faye = require('faye');


////////////////////////////////////////////////////////////////////////////////


// attaches faye adapter to the `server`
//
module.exports.attach = function attach(server, next) {
  var faye = new Faye.NodeAdapter({ mount: '/faye' });

  if (process.env.FAYE_LOGLEVEL) {
    // This produces lots of logs, which are usefull
    // only during development of RT things.
    // USAGE: FAYE_LOGLEVEL=info ./fontello.js server
    Faye.Logging.logLevel = process.env.FAYE_LOGLEVEL;
  }

  faye.attach(server);
  next();
};
