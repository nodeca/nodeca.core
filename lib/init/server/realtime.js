"use strict";


/*global nodeca, _*/


// 3rd-party
var Faye = require('faye');


////////////////////////////////////////////////////////////////////////////////


var realtime = module.exports = {
  activeClients: 0
};


////////////////////////////////////////////////////////////////////////////////


var noop = function () {};


////////////////////////////////////////////////////////////////////////////////


// attaches faye adapter to the `server`
//
realtime.attach = function attach(server, next) {
  var faye = new Faye.NodeAdapter({mount: '/faye'});

  if (process.env.FAYE_LOGLEVEL) {
    // This produces lots of logs, which are usefull
    // only during development of RT things.
    // USAGE: FAYE_LOGLEVEL=info ./fontello.js server
    Faye.Logging.logLevel = process.env.FAYE_LOGLEVEL;
  }

  // FIXME: Replace dummy active_clients inc/dec with real heartbeat/timeouts
  faye.bind('handshake',  function () { realtime.activeClients++; });
  faye.bind('disconnect', function () { realtime.activeClients--; });


  var curr_users_count = 0;
  setInterval(function () {
    if (realtime.activeClients !== curr_users_count) {
      curr_users_count = realtime.activeClients;
      faye.getClient().publish('/stats/users_online', curr_users_count);
    }
  }, 10000);


  faye.attach(server);
  next();
};
