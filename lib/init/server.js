"use strict";


/*global nodeca, _*/


// stdlib
var readFileSync        = require('fs').readFileSync;
var createServer        = require('http').createServer;
var createSecureServer  = require('https').createServer;
var url                 = require('url');


// 3rd-party
var async     = require('nlib').Vendor.Async;
var treeGet   = require('nlib').Support.tree.get;
var parseURL  = require('nlib').Vendor.Pointer.parseURL;
var qs        = require('qs');


// internal
var env = require('../env');
var handle_http = require('./server/handle_http');
var handle_rpc  = require('./server/handle_rpc');


////////////////////////////////////////////////////////////////////////////////


// helper that starts http server and waits for it to bind to specified host and
// port (see configuration listen section).
//
function startServer(options, next) {
  var address = options.address,
      port    = options.port,
      server  = createServer();

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
//      hosts:  [ 'localhost', ... ]
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


// starts http(s) server(s) and attach application listener to it
//
module.exports = function (next) {
  var bindings = extractBindings(nodeca.config.bind),
      handle_invalid_host = nodeca.config.bind._;

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

  if (!_.isFunction(handle_invalid_host)) {
    handle_invalid_host = function (req, res) {
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
      var host_is_valid; // function used to validate request host

      if (err) {
        nextPoint(err);
        return;
      }

      //
      // Notify that we started listening
      //

      nodeca.logger.info('Listening on ' + options.address + ':' + options.port +
                         ' ' + (options.ssl ? 'SSL' : 'NON-SSL'));

      //
      // Create host validation function
      //

      if (_.include(options.hosts, '*')) {
        // if binding address:port has *any host* mount point,
        // skip host validation
        host_is_valid = function () {
          return true;
        };
      } else {
        host_is_valid = function filterHosts(host) {
          return _.include(options.hosts, host);
        };
      }

      //
      // For each upcoming connection - update timeout & disable buffering
      //

      server.addListener("connection", function (socket) {
        socket.setTimeout(15 * 1000);
        socket.setNoDelay();
      });

      //
      // Define application runner
      //

      server.on('request', function (req, res) {
        var parsed, handle, data;

        if (!host_is_valid(req.headers.host)) {
          handle_invalid_host(req, res);
          return;
        }

        parsed  = url.parse(req.url);
        handle  = ('/io/rpc' === parsed.pathname) ? handle_rpc : handle_http;
        data    = '';

        req.query     = qs.parse(parsed.query || '');
        req.pathname  = parsed.pathname;

        //
        // start harvesting POST data
        //

        req.on('data', function (chunk) {
          data += chunk;
        });

        //
        // when done, merge post params and handle request
        //

        req.on('end', function () {
          req.params = _.defaults(qs.parse(data), req.query);
          handle(req, res);
        });
      });

      //
      // all done, step to the next binding
      //

      nextPoint();
    });
  }, next);
};
