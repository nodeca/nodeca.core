// Initializes (start) HTTP and RPC server listeners.
// Used as last step in `cli/server.js`
//
// Emits sub events `init:server.https` and `init:server.http`
//


'use strict';


const cluster     = require('cluster');
const fs          = require('fs');
const http        = require('http');
const https       = require('https');
const os          = require('os');
const path        = require('path');
const querystring = require('querystring');
const url         = require('url');

const _        = require('lodash');
const async    = require('async');
const parseURL = require('url').parse;

const env = require('../env');


////////////////////////////////////////////////////////////////////////////////


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
function extractBindings(config, mainApp, logger) {
  let result = {};

  // Collect non-SSL bindings.
  _.forEach(config, options => {
    if (!result[options.listen]) {
      result[options.listen] = {
        address:   options.listen.address,
        port:      options.listen.port,
        forwarded: options.forwarded,
        hosts:     [],
        ssl:       null
      };
    }
  });

  // Collect SSL bindings.
  _.forEach(config, options => {

    if (!options.ssl) { return; }

    if (!result[options.ssl.listen]) {
      result[options.ssl.listen] = {
        address:   options.ssl.listen.address,
        port:      options.ssl.listen.port,
        forwarded: options.ssl.forwarded,
        hosts:     [],
        ssl:       _.omit(options.ssl, 'listen')
      };

      // Read files.
      [ 'key', 'cert' ].forEach(val => {
        if (!options.ssl[val]) { return; }

        let filename = path.resolve(mainApp.root, options.ssl[val]);

        try {
          result[options.ssl.listen].ssl[val] = fs.readFileSync(filename, 'utf8');
        } catch (err) {
          logger.error(`Can't read ${val}-file from SSL config (${filename}): ${err}`);
        }
      });
    }
  });

  // Fill-in host lists that should be served by <address:port>
  _.forEach(config, options => {
    let host = parseURL(options.mount, false, true).host || '*';

    // For non-SSL.
    if (result[options.listen].hosts.indexOf(host) < 0) {
      result[options.listen].hosts.push(host);
    }

    // For SSL.
    if (options.ssl && result[options.ssl.listen].hosts.indexOf(host) < 0) {
      result[options.ssl.listen].hosts.push(host);
    }
  });

  return result;
}


// Returns protocol name of `req` request object.
// If `isForwarded` is true, it will respect X-Forwarded-* headers used when
// Nodeca is behind a proxy.
//
function getRequestProtocol(req, isForwarded) {
  if (!isForwarded) { return req.connection.encrypted ? 'https' : 'http'; }

  if (req.headers['x-forwarded-ssl'] === 'on') { return 'https'; }

  if (req.headers['x-forwarded-scheme']) {
    return req.headers['x-forwarded-scheme'];
  }

  if (req.headers['x-forwarded-proto']) {
    return req.headers['x-forwarded-proto'].split(/\s*,\s*/)[0];
  }

  return req.connection.encrypted ? 'https' : 'http';
}


// Returns remote IP address of `req` request object.
// If `isForwarded` is true, it will respect `X-Real-IP` and `X-Forwarded-For`
// header (when Nodeca is behind a proxy).
//
function getRequestRemoteAddress(req, isForwarded) {
  if (!isForwarded) { return req.connection.remoteAddress; }

  if (req.headers['x-real-ip']) { return req.headers['x-real-ip']; }

  if (req.headers['x-forwarded-for']) {
    // X-Forwarded-For can contain chain of proxies.
    return req.headers['x-forwarded-for'].split(/\s*,\s*/)[0];
  }

  return req.connection.remoteAddress;
}


// Parses URL query string and resolves numbers and booleans.
//
function parseQueryString(inputQuery) {
  if (!inputQuery) {
    return {};
  }

  return querystring.parse(String(inputQuery));
}


// MODULE EXPORTS //////////////////////////////////////////////////////////////


// starts http(s) server(s) and attach application listener to it
//
module.exports = function (N) {

  N.wire.on('init:server', function cluster_init(N, callback) {
    if (cluster.isMaster && N.environment !== 'development') {
      // run workers without any arguments
      cluster.setupMaster({ args: [] });

      let done = _.once(callback);

      /* eslint-disable no-loop-func */
      for (let i = 0; i < os.cpus().length; i++) {
        let worker = cluster.fork();

        worker.on('listening', () => done());
      }
    } else {
      N.wire.emit('init:server.worker', N, callback);
    }
  });


  N.wire.on('init:server.worker', function server_bind(N, cb) {
    let bindings = extractBindings(N.config.bind, N.mainApp, N.logger);

    //
    // bind listeners
    //

    async.eachSeries(_.keys(bindings), (point, next) => {
      let options = bindings[point],
          address = options.address,
          port    = options.port,
          server,
          host_is_valid;

      try {
        server = options.ssl ? https.createServer(options.ssl) : http.createServer();
      } catch (err) {
        next(err); // Possibly bad SSL options.
        return;
      }

      //
      // Create host validation function
      //

      if (options.hosts.indexOf('*') !== -1) {
        // if binding address:port has *any host* mount point,
        // skip host validation
        host_is_valid = () => true;
      } else {
        host_is_valid = host => options.hosts.indexOf(host) !== -1;
      }

      //
      // attach event handlers
      //

      server.on('error', function handle_startup_error(err) {
        let err_prefix = `Can't bind to <${address}> with port <${port}>: `;

        if (err.code === 'EADDRINUSE') {
          next(err_prefix + 'Address in use...');
          return;
        }

        if (err.code === 'EADDRNOTAVAIL') {
          // system has no such ip address
          next(err_prefix + 'Address is not available...');
          return;
        }

        if (err.code === 'ENOENT') {
          // failed resolve addressname to ip address
          next(err_prefix + 'Failed to resolve IP address...');
          return;
        }

        // unexpected / unknown error
        next(err_prefix + err);
      });


      server.on('connection', socket => {
        socket.setTimeout(15 * 1000);
        socket.setNoDelay();
      });


      server.on('request', (req, res) => {
        let isEncrypted,
            parsedUrl,
            fullUrl,
            type,
            routeMatch,
            remoteAddress;

        remoteAddress = getRequestRemoteAddress(req, options.forwarded);

        if (req.connection.destroyed || !remoteAddress) {
          // Abort if connection is closed before we received the request,
          // this should never happen, but we added this check just in case.
          return;
        }

        if (_.isEmpty(req.headers.host)) {
          // Host header is not set or empty.
          res.writeHead(N.io.BAD_REQUEST, { 'Content-Type': 'text/plain' });
          res.end(`[${N.io.BAD_REQUEST}] Bad Request: missed 'Host' header`);
          return;
        }

        if (!host_is_valid(req.headers.host)) {
          // Host is unknown.
          res.writeHead(N.io.NOT_FOUND, { 'Content-Type': 'text/plain' });
          res.end(`Invalid host ${req.headers.host}`);
          return;
        }

        // Frontend server may handle HTTPS request from the client
        // but connect with us via plain HTTP. So, detect protocol.
        let protocol = getRequestProtocol(req, options.forwarded);

        isEncrypted  = protocol === 'https';
        parsedUrl    = url.parse(req.url);
        fullUrl      = protocol + '://' + req.headers.host + parsedUrl.pathname;
        req.query    = parseQueryString(parsedUrl.query);

        //
        // Choose a responder to use.
        //

        if (parsedUrl.pathname === '/io/rpc') {
          type = 'rpc';
        } else {
          type = 'http';

          let httpMethod   = req.method.toLowerCase();

          routeMatch = _.find(N.router.matchAll(fullUrl),
                              match => _.has(match.meta.methods, httpMethod));

          if (routeMatch) {
            type = routeMatch.meta.responder;
            routeMatch.params = routeMatch.params || {};
          }
        }

        //
        // Try to process request: create environment & run responder chain
        // Responders are totally pluggable, via hooks
        //

        let _env = env(N, {
          req,
          res,
          type,
          isEncrypted,
          matched: routeMatch,
          remoteAddress
        });

        N.wire.emit('responder:' + type, _env);
      });


      server.on('listening', () => {
        // remove error and listening handlers,
        // once we successfully bounded on address:port
        server.removeAllListeners('error');
        server.removeAllListeners('listening');

        //
        // Notify that we started listening
        //

        N.logger.info('Listening on %s:%s %s',
                      options.address,
                      options.port,
                      options.ssl ? 'SSL' : 'NON-SSL');

        //
        // Successfully binded, process to the next mount point
        //

        next();
      });

      //
      // emit sub event and try to bind to the port
      //

      N.wire.emit(options.ssl ? 'init:server.https' : 'init:server.http', server, err => {
        if (err) {
          next(err);
          return;
        }

        server.listen(port, address);
      });
    },

    err => {
      if (err) {
        cb(err);
        return;
      }

      N.logger.info('Services init done');
      cb();
    });
  });
};
