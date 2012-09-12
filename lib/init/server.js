"use strict";


/*global nodeca, _*/


// stdlib
var readFileSync        = require('fs').readFileSync;
var createHttpServer    = require('http').createServer;
var createSecureServer  = require('https').createServer;


// 3rd-party
var async     = require('nlib').Vendor.Async;
var treeGet   = require('nlib').Support.tree.get;
var parseURL  = require('nlib').Vendor.Pointer.parseURL;


// internal
var listener = require('./server/http');


////////////////////////////////////////////////////////////////////////////////


// helper that starts http server and waits for it to bind to specified host and
// port (see configuration listen section).
//
function startServer(options, next) {
  var address = options.address,
      port    = options.port,
      server  = createHttpServer();

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


function startSecureServer(options, next) {
  var address = options.address,
      port    = options.port,
      server  = createSecureServer(options);

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
//      ssl:     null,
//      domains: [ 'localhost', ... ]
//    },
//    // ...
//  }
//
function extractBindings(config) {
  var result = {};

  //
  // Prepare config
  //

  _.each(config, function (options, key) {
    var host;

    if ('_' === key) {
      // skip special case keyword
      return;
    }

    if (!result[options.listen]) {
      result[options.listen] = {
        address:  options.listen.split(':')[0] || '0.0.0.0',
        port:     options.listen.split(':')[1] || 80,
        ssl:      null,
        hosts:    []
      };
    }

    result[options.listen].ssl = result[options.listen].ssl || options.ssl;

    host = parseURL(options.mount).host || '*';
    if (-1 === result[options.listen].hosts.indexOf(host)) {
      result[options.listen].hosts.push(host);
    }
  });

  //
  // Read `key`, `cert` and `pfx` files if given
  //

  _.each(result, function (options, key) {
    if (options.ssl) {
      _.each(options.ssl, function (file, part) {
        if ('pfx' === part || 'key' === part || 'cert' === part) {
          options.ssl[part] = readFileSync(file);
        }
      });
    }
  });

  return result;
}


// MODULE EXPORTS //////////////////////////////////////////////////////////////


// starts http server and attach application HTTP server and Faye realtime
// servers to it
//
module.exports = function (next) {
  var config       = nodeca.config.bind,
      bindings     = extractBindings(config),
      invalid_host = config._;

  try {
    // add support for webkit devtools
    require('webkit-devtools-agent');
    nodeca.logger.info('webkit-devtools-agent enabled');
  } catch (err) {
    // do nothing
    nodeca.logger.warn('webkit-devtools-agent disabled');
  }

  //
  // set "host not found" handler if it was not set
  //

  if (!_.isFunction(invalid_host)) {
    invalid_host = function (req, res) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Invalid host ' + req.headers.host);
    };
  }

  //
  // bind listeners
  //

  async.forEachSeries(_.keys(bindings), function (point, nextPoint) {
    var options = bindings[point];

    (options.ssl ? startSecureServer : startServer)(options, function (err, server) {
      var prepare;

      if (err) {
        nextPoint(err);
        return;
      }

      // makes common preparations before
      // actual request processing
      if (_.include(options.hosts, '*')) {
        prepare = function (req, res, callback) {
          callback();
        };
      } else {
        prepare = function (req, res, callback) {
          if (!_.include(options.hosts, req.headers.host)) {
            invalid_host(req, res);
            return;
          }

          callback();
        };
      }

      nodeca.logger.info('Listening on ' + options.address + ':' + options.port +
                         ' ' + (options.ssl ? 'SSL' : 'NON-SSL'));

      listener.attach(server, prepare, nextPoint);
    });
  }, next);
};
