"use strict";


/*global nodeca, _*/


// stdlib
var url   = require('url');
var zlib  = require('zlib');
var http  = require('http');


// 3rd-party
var qs = require('qs');


// internal
var env = require('../../env');


// nodeca
var HashTree = require('nlib').Support.HashTree;


////////////////////////////////////////////////////////////////////////////////


function log(req, res, code, env, err) {
  var // FIXME: env might not be yet defined (when router didn't matched)
      logger  = nodeca.logger.getLogger(env ? ('server.' + env.request.method) : 'server'),
      level   = (err && 'error') || (400 <= code && 'warn') || 'info',
      message = (err && err.stack) || (err && err.message) || err || http.STATUS_CODES[code];

  logger[level]('%s - "%s %s HTTP/%s" %d "%s" - %s',
                req.connection.remoteAddress,
                req.method,
                req.url,
                req.httpVersion,
                code,
                req.headers['user-agent'],
                message);
}

// Ends response with given `code`, `head`ers and `body`.
// Rejects body if request method was HEAD
//
function end(req, res, code, head, body, env, err) {
  // set headers
  _.each(head || {}, function (value, name) {
    if (null === value) {
      this.removeHeader(name);
      return;
    }

    this.setHeader(name, value);
  }, res);

  // Remove Accept-Ranges if it wasn't explicitly set
  if (!(head || {})['Accept-Ranges']) {
    res.removeHeader('Accept-Ranges');
  }

  // remove body, when it's not supposed to be sent
  if ('HEAD' === req.method) {
    // TODO: notify about smells in the code :))
    body = null;
  } else if (!body) {
    // auto-set body based on status code
    body = http.STATUS_CODES[code];
  }

  if (!res.getHeader('Content-Type')) {
    nodeca.logger.error('Required header Content-Type was not set in ' +
                        env.request.method);
  }

  //
  // Set some obligatory headers
  //

  res.setHeader('Server', 'Sansung Calakci');
  res.setHeader('Date',   (new Date).toUTCString());

  log(req, res, code, env, err);

  //
  // We don't give a shit about Content-Length as Node.JS will take care of it.
  //

  // set status code and send body (if any)
  res.statusCode = code;
  res.end(body);
}


////////////////////////////////////////////////////////////////////////////////


// Parses `req.url` and sets `req.query` with result object.
//
function parse_query(req) {
  if (!req.query) {
    req.query = (-1 === req.url.indexOf('?')) ? {}
              : qs.parse(url.parse(req.url).query);
  }

  return req.query;
}


// Sanitize URL (appends HOST if needed), removes query part
//
function clean_req_url(req) {
  var host = req.headers.host;

  if (-1 === nodeca.runtime.router.__vhosts__.known.indexOf(host)) {
    host = nodeca.runtime.router.__vhosts__.default_host;
  }

  if (host) {
    host = '//' + host;
  }

  return host + req.url.split('?').shift();
}


// Handles errors.
//
function process_error(req, res, err, env) {
  var body;

  //
  // user asks for request termination providing:
  //
  //    - statusCode  (Number)
  //    - headers     (Object)        Optional
  //    - body        (String|Buffer) Optional
  //

  if (err.statusCode) {
    err.headers = _.defaults(err.headers || {}, {'Content-Type': 'text/plain; charset=utf-8'});
    end(req, res, err.statusCode, err.headers, err.body, env);
    return;
  }

  //
  // exceptions or fatal fuckup happened
  //

  body = ('development' !== nodeca.runtime.env) ? 'Application error'
       : (err.stack || err.toString());
  end(req, res, 500, {'Content-Type': 'text/plain; charset=utf-8'}, body, env, err);
}


// Returns whenever or not compression is allowed by client
//
// - `'gzip'` if GZip allowed
// - `'deflate'` if Deflate allowed
// - `false` otherwise
//
function get_allowed_compression(req) {
  var accept = req.headers['accept-encoding'] || '';

  if ('*' === accept || 0 <= accept.indexOf('gzip')) {
    return 'gzip';
  }

  if (0 <= accept.indexOf('deflate')) {
    return 'deflate';
  }

  return false;
}


// small helper to run compressor
//
function compress(algo, source, callback) {
  ('gzip' === algo ? zlib.gzip : zlib.deflate)(source, callback);
}


// Final callback of the Hooker#run
//
function finalize(err) {
  var env, http, resp, type, compression;

  /*jshint validthis:true*/

  if (err) {
    process_error(this.origin.http.req, this.origin.http.res, err, this);
    return;
  }

  //
  // Shorten some vars
  //

  env  = this;
  http = this.origin.http;
  resp = this.response;

  //
  // Check whenever compression is allowed by client or not
  //

  type = resp.headers['Content-Type'] || http.res.getHeader('Content-Type');
  compression = /json|text|javascript/.test(type) && get_allowed_compression(http.req);

  //
  // Mark for proxies, that we can return different content (plain & gzipped),
  // depending on specified (comma-separated) headers
  //

  resp.headers['Vary'] = 'Accept-Encoding';

  //
  // Return raw response, if compression is not allowed or body is too small
  //

  if (false === compression || 500 > Buffer.byteLength(resp.body)) {
    end(http.req, http.res, resp.statusCode || 200, resp.headers, resp.body, env);
    return;
  }

  //
  // Compression is allowed, set Content-Encoding
  //

  resp.headers['Content-Encoding'] = compression;

  //
  // Compress body
  //

  compress(compression, resp.body, function (err, buffer) {
    if (err) {
      process_error(http.req, http.res, err, env);
      return;
    }

    end(http.req, http.res, resp.statusCode || 200, resp.headers, buffer, env);
  });
}


////////////////////////////////////////////////////////////////////////////////


// Attach HTTP application server to the given `server`
//
module.exports.attach = function attach(server, next) {

  //
  // For each connection - update timeout & disable buffering
  //

  server.addListener("connection", function (socket) {
    socket.setTimeout(15 * 1000);
    socket.setNoDelay();
  });

  //
  // Assign middlewares/hooks
  //

  // register fix_vhost midleware
  nodeca.filters.before('', {weight: -900}, require('./http/fix_vhost'));

  // register renderer middleware
  nodeca.filters.after('', {weight: 900}, require('./http/renderer'));

  //
  // Define application runner
  //

  server.on('request', function app_server(req, res) {
    var query  = parse_query(req),
        match  = nodeca.runtime.router.match(clean_req_url(req)),
        // mix GET QUERY params (part after ? in URL) and params from router
        // params from router take precedence
        params = _.extend({}, query, (match || {}).params),
        func;

    if (!match) {
      // Route not found
      end(req, res, 404, {'Content-Type': 'text/plain'}, 'Not Found');
      return;
    }

    func = HashTree.get(nodeca.server, match.meta);
    nodeca.filters.run(match.meta, params, func, finalize, env({
      http:   {req: req, res: res},
      method: match.meta,
      params: params
    }));
  });

  //
  // HTTP server is ready
  //

  next();

};
