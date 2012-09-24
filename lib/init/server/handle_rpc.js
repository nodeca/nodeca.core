"use strict";


/*global nodeca, _*/


// stdlib
var http = require('http');


// 3rd-party
var treeGet = require('nlib').Support.tree.cache.get;
var qs      = require('qs');


// internal
var env         = require('../../env');
var compression = require('./compression');
var logger      = nodeca.logger.getLogger('rpc');


////////////////////////////////////////////////////////////////////////////////


var MAX_POST_DATA = 100 * 1024; // Max post data in bytes


////////////////////////////////////////////////////////////////////////////////


function log(req, res) {
  var level = 'info', message = 'OK';

  if (res.error) {
    message = res.error.message || JSON.stringify(res.error);

    if (!res.error.statusCode || 500 <= res.error.statusCode) {
      level = 'fatal';
    } else if (400 <= res.error.statusCode && 500 > res.error.statusCode) {
      level = 'error';
    } else {
      level = 'info';
    }
  }

  logger[level]('%s - %s() - "%s" - %s',
                req.connection.remoteAddress,
                req.payload.method,
                req.headers['user-agent'],
                message);
}


// Ends response with given `error`, `response` and nodeca version.
//
function end(req, res, error, response) {
  var payload, compressor, size;

  //
  // Set some obligatory headers
  //

  res.removeHeader('Accept-Ranges');

  res.setHeader('Content-Type', 'application/json; charset=UTF-8');
  res.setHeader('Server', 'Sansung Calakci');
  res.setHeader('Date',   (new Date).toUTCString());

  //
  // Prepare and stringify payload
  //

  payload = res.payload = JSON.stringify({
    version:  nodeca.runtime.version,
    error:    error,
    response: error ? null : response
  });

  //
  // Status code always OK
  //

  res.error       = error;
  res.statusCode  = 200;

  //
  // Check whenever compression is allowed by client or not
  //

  compressor = compression.is_allowed(req);

  //
  // Mark for proxies, that we can return different content (plain & gzipped),
  // depending on specified (comma-separated) headers
  //

  res.setHeader('Vary', 'Accept-Encoding');

  //
  // Return raw response, if compression is not allowed or body is too small
  //

  size = Buffer.byteLength(payload);

  if (false === compressor || 500 > size) {
    log(req, res);
    res.setHeader('Content-Length', size);
    res.end(payload);
    return;
  }

  //
  // Compress body
  //

  compression.process(compressor, payload, function (err, buffer) {
    if (err) {
      // should never happen
      nodeca.logger.fatal('Failed to compress RPC response', err);

      res.error   = err;
      res.payload = JSON.stringify({
        version:  nodeca.runtime.version,
        error:    err,
        response: null
      });

      log(req, res);
      res.end(res.payload);
      return;
    }

    //
    // Compression is allowed and succeed, set Content-Encoding
    //

    res.setHeader('Content-Encoding', compressor);
    res.setHeader('Content-Length', buffer.length);
    log(req, res);
    res.end(buffer);
  });
}


// handles error
//
function process_error(req, res, err) {
  var message;

  //
  // user asks for request termination providing:
  //
  //    - statusCode  (Number)
  //    - headers     (Object)        Optional
  //    - body        (String|Buffer) Optional
  //

  if (err.statusCode) {
    end(req, res, {
      statusCode: err.statusCode,
      headers: err.headers,
      message: err.body
    }, null);
    return;
  }

  //
  // exceptions or fatal fuckup happened
  //

  message = ('development' !== nodeca.runtime.env) ? 'Application error'
          : (err.stack || err.toString());
  end(req, res, {statusCode: 500, message: message}, null);
}


function noop() {}


////////////////////////////////////////////////////////////////////////////////


module.exports = function handle_rpc(req, res) {
  var data = '';

  //
  // set empty payload object
  //

  req.payload = {};

  //
  // invalid request
  //

  if ('POST' !== req.method) {
    process_error(req, res, { statusCode: 400, body: 'Invalid request method' });
    return;
  }

  //
  // start harvesting POST data
  //

  req.on('data', function (chunk) {
    if (MAX_POST_DATA < Buffer.byteLength(data += chunk)) {
      // max allowed post data reached, drop request.
      req.removeAllListeners('data');
      req.removeAllListeners('end');

      process_error(req, res, { statusCode: 401, body: 'Max POST data reached' });
    }
  });

  //
  // when done (on success) process POST data and handle request
  //

  req.on('end', function () {
    var payload = _.defaults(qs.parse(data), req.query),
        params  = payload.params || {},
        func, validation;

    // save payload in the request
    req.payload = payload;

    // save CSRF token if it was sent
    req.csrf = payload.csrf;

    // invalid payload
    if (!payload.version || !payload.method) {
      process_error(req, res, { statusCode: 400, body: 'Invalid payload' });
      return;
    }

    // invalid client version.
    // client will check server version by it's own,
    // so in fact this error is not used by client
    if (payload.version !== nodeca.runtime.version) {
      process_error(req, res, { statusCode: 400, body: 'Client version mismatch' });
      return;
    }

    func = treeGet(nodeca.server, payload.method);

    // invalid method name
    if (!func) {
      process_error(req, res, { statusCode: 404, body: 'API path not found' });
      return;
    }

    validation = nodeca.validate.test(payload.method, params);

    // when method has no validation schema,
    // test() returns `null`, object with `valid` property otherwise
    if (!validation) {
      process_error(req, res, "Params schema is missing for " + payload.method);
      return;
    }

    if (!validation.valid) {
      validation.code = 'INVALID_PARAMS';
      process_error(req, res, validation);
      return;
    }

    nodeca.filters.run(payload.method, params, func, function (err) {
      if (err) {
        process_error(req, res, err);
        return;
      }

      end(req, res, null, this.response);
    }, env({
      rpc:    { req: req, res: res },
      method: payload.method
    }));
  });
};
