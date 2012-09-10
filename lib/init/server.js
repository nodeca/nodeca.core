"use strict";


/*global nodeca, _*/


// stdlib
var createHttpServer = require('http').createServer;


// 3rd-party
var async   = require('nlib').Vendor.Async;
var treeGet = require('nlib').Support.tree.get;


// internal
var listener = require('./server/http');


////////////////////////////////////////////////////////////////////////////////


// helper that starts http server and waits for it to bind to specified host and
// port (see configuration listen section).
//
function startServer(address, port, next) {
  var server = createHttpServer();

  function handle_server_error(err) {
    var err_prefix = "Can't bind to <" + address + "> with port <" + port + ">: ";

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
      // failed resolve addressname to ip address
      next(err_prefix + "Failed to resolve IP address...");
      return;
    }

    // unexpected / unknown error
    next(err_prefix + err);
  }

  server.on('error', handle_server_error);

  // start server
  server.listen(port, address, function () {
    server.removeListener('error', handle_server_error);
    next(null, server);
  });
}


// Parse binding config and returns a parsed map:
//
//  {
//    '127.0.0.1:3000': {
//      address: '127.0.0.1',
//      port:    3000,
//      ssl:     false,
//      domains: [ 'localhost', ... ]
//    },
//    // ...
//  }
//
function extractBindings(config) {
  var result = {};

  _.each(config, function (options, key) {
    var domain;

    if ('_' === key) {
      // skip special case keyword
      return;
    }

    if (!result[options.listen]) {
      result[options.listen] = {
        domains:  [],
        address:  options.listen.split(':').shift() || '0.0.0.0',
        port:     options.listen.split(':').pop() || '3000'
      };
    }

    result[options.listen].ssl = !!(result[options.listen].ssl || options.ssl);

    domain = (/^(?:https?:)?\/\/([^\/]+)(\/|$)/).exec(options.mount)[1];
    if (-1 === result[options.listen].domains.indexOf(domain)) {
      result[options.listen].domains.push(domain);
    }
  });

  return result;
}


// Default action when host is not supposed to be served by listener
//
function domainNotFound(params, callback) {
  /*jshint validthis:true*/
  var hostname = (this.origin.http || this.origin.rpc).req.headers.host;
  callback(new Error('Hostname is not allowed: ' + hostname));
}


// MODULE EXPORTS //////////////////////////////////////////////////////////////


// starts http server and attach application HTTP server and Faye realtime
// servers to it
//
module.exports = function (next) {
  var config          = nodeca.config.router.bind,
      bindings        = extractBindings(config),
      invalid_domain  = treeGet(nodeca.server, config._, domainNotFound);

  try {
    // add support for webkit devtools
    require('webkit-devtools-agent');
    nodeca.logger.info('webkit-devtools-agent enabled');
  } catch (err) {
    // do nothing
    nodeca.logger.warn('webkit-devtools-agent disabled');
  }

  async.forEachSeries(_.keys(bindings), function (point, nextPoint) {
    var options = bindings[point];

    startServer(options.address, options.port, function (err, server) {
      if (err) {
        nextPoint(err);
        return;
      }

      nodeca.logger.info('Listening on ' + options.address + ':' + options.port);
      listener.attach(server, nextPoint);
    });
  }, next);
};
