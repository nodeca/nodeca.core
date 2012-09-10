"use strict";


/*global nodeca, _*/


// stdlib
var createHttpServer = require('http').createServer;


// 3rd-party
var Async = require('nlib').Vendor.Async;


// internal
var listener = require('./server/http');


////////////////////////////////////////////////////////////////////////////////


// helper that starts http server and waits for it to bind to specified host and
// port (see configuration listen section).
//
function startServer(host, port, next) {
  var server = createHttpServer();

  function handle_server_error(err) {
    var err_prefix = "Can't bind to <" + host + "> with port <" + port + ">: ";

    if ('EADDRINUSE' === err.code) {
      next(err_prefix + 'Address in use...');
      return;
    }

    if ('EADDRNOTAVAIL' === err.code) {
      // system has no such ip address
      next(err_prefix + 'Address is not available...');
      return;
    }

    if ('ENOENT' === err.code) {
      // failed resolve hostname to ip address
      next(err_prefix + "Failed to resolve IP address...");
      return;
    }

    // unexpected / unknown error
    next(err_prefix + err);
  }

  server.on('error', handle_server_error);

  // start server
  server.listen(port, host, function () {
    server.removeListener('error', handle_server_error);
    next(null, server);
  });
}


// MODULE EXPORTS //////////////////////////////////////////////////////////////


// starts http server and attach application HTTP server and Faye realtime
// servers to it
//
module.exports = function (next) {
  // create server
  var host = nodeca.config.router.bind['default'].listen.split(':').shift() || 'localhost';
  var port = nodeca.config.router.bind['default'].listen.split(':').pop() || 3000;

  try {
    // add support for webkit devtools
    require('webkit-devtools-agent');
    nodeca.logger.info('webkit-devtools-agent enabled');
  } catch (err) {
    // do nothing
    nodeca.logger.warn('webkit-devtools-agent disabled');
  }

  startServer(host, port, function (err, server) {
    if (err) {
      next(err);
      return;
    }

    listener.attach(server, next);
  });
};
