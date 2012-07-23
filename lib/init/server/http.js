"use strict";


/*global nodeca, _*/


// stdlib
var url = require('url');
var zlib = require('zlib');


// 3rd-party
var qs = require('qs');


// internal
var env = require('../../env');


// nodeca
var HashTree = require('nlib').Support.HashTree;


////////////////////////////////////////////////////////////////////////////////


var http = module.exports = {};


////////////////////////////////////////////////////////////////////////////////


// Ends response with given `code`, `head`ers and `body`.
// Rejects body if request method was HEAD
//
function end(req, res, code, head, body) {
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
  }

  //
  // Set some obligatory headers
  //

  res.setHeader('Server', 'Sansung Calakci');
  res.setHeader('Date',   (new Date).toUTCString());

  // TODO: log access info

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
function process_error(req, res, err, log) {
  var body;

  //
  // user asks for request termination providing:
  //
  //    - statusCode  (Number)
  //    - headers     (Object)        Optional
  //    - body        (String|Buffer) Optional
  //

  if (err.statusCode) {
    if (400 <= err.statusCode) {
      log('error', err.statusCode + ' - ' + err.body);
    }

    end(req, res, err.statusCode, err.headers || {}, err.body);
    return;
  }

  //
  // exceptions or fatal fuckup happened
  //

  body = ('development' !== nodeca.runtime.env) ? 'Application error'
       : (err.stack || err.toString());

  log('error', 500 + ' - ' + (err.stack || err.toString()));
  nodeca.logger.fatal(err);

  end(req, res, 500, {'Content-Type': 'text/plain; charset=utf-8'}, body);
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
  var http, resp, type, compression, log;

  /*jshint validthis:true*/

  if (err) {
    process_error(this.origin.http.req, this.origin.http.res, err, this.extras.log);
    return;
  }

  //
  // Shorten some vars
  //

  http = this.origin.http;
  resp = this.response;
  log  = this.extras.log;

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
    end(http.req, http.res, resp.statusCode || 200, resp.headers, resp.body);
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
      process_error(http.req, http.res, err, log);
      return;
    }

    end(http.req, http.res, resp.statusCode || 200, resp.headers, buffer);
  });
}


////////////////////////////////////////////////////////////////////////////////


// Attach HTTP application server to the given `server`
//
http.attach = function attach(server, next) {

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
      method: match.meta
    }));
  });

  //
  // HTTP server is ready
  //

  next();

};
