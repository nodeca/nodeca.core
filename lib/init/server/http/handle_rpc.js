"use strict";


/*global nodeca, _*/


// stdlib
var http = require('http');


// nodeca
var HashTree = require('nlib').Support.HashTree;


// internal
var env         = require('../../../env');
var compression = require('./compression');
var logger      = nodeca.logger.getLogger('rpc');


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
  var payload, compressor;

  //
  // Set some obligatory headers
  //

  res.removeHeader('Accept-Ranges');

  res.setHeader('Content-Type', 'application/json');
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
  res.setHeader('Content-Type', 'application/json');

  //
  // Return raw response, if compression is not allowed or body is too small
  //

  if (false === compressor || 500 > Buffer.byteLength(payload)) {
    log(req, res);
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
    log(req, res);
    res.end(buffer);
  });
}


function process_error(req, res, err) {
  var message;

  //
  // user asks for request termination providing:
  //
  //    - statusCode  (Number)
  //    - body        (String|Buffer) Optional
  //

  if (err.statusCode) {
    end(req, res, {statusCode: err.statusCode, message: err.body}, null);
    return;
  }

  //
  // exceptions or fatal fuckup happened
  //

  message = ('development' !== nodeca.runtime.env) ? 'Application error'
          : (err.stack || err.toString());
  end(req, res, {statusCode: 500, message: message}, null);
}


////////////////////////////////////////////////////////////////////////////////


module.exports = function handle_rpc(req, res) {
  var payload = req.params,
      params  = payload.params || {},
      msg, func, validation;

  // save request payload
  req.payload = payload;

  // invalid request
  if ('POST' !== req.method) {
    process_error(req, res, { statusCode: 400, body: 'Invalid request method' });
    return;
  }

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

  func = HashTree.get(nodeca.server, payload.method);

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
    process_error(req, res, "Invalid params:\n" +
        validation.errors.map(function (err) {
          return "- " + err.property + ' ' + err.message;
        }).join('\n'));
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
};
