// Send reply to client.
// We expect, to have:
// - env.response
//   - body
//   - headers
//   - log


'use strict';


// stdlib
var http = require('http');


// 3rd-party
var _ = require('lodash');


////////////////////////////////////////////////////////////////////////////////


module.exports = function (N) {

  N.wire.after('responder:*', { priority: 100 }, function send_reply(env) {
    var res = env.origin.res
      , headers = env.headers
      , body = env.body
      , statusCode;

    //
    // set headers
    //

    _.each(headers, function (value, name) {
      if (null === value) {
        this.removeHeader(name);
        return;
      }
      this.setHeader(name, value);
    }, res);

    //
    // Remove Accept-Ranges if it wasn't explicitly set
    //

    if (!headers['Accept-Ranges']) {
      res.removeHeader('Accept-Ranges');
    }


    //
    // should not happen
    //

    if (!res.getHeader('Content-Type')) {
      N.logger.fatal('Required header Content-Type was not set in ' + env.method);
    }

    //
    // Set some obligatory headers
    //

    res.setHeader('Server', 'Sansung Calakci');
    res.setHeader('Date',   (new Date).toUTCString());

    //
    // When body is given, it MUST be a Buffer or a String
    // (this error should not happen)
    //

    if (body && !Buffer.isBuffer(body) && 'string' !== typeof body) {
      statusCode = N.io.APP_ERROR;
      body = http.STATUS_CODES[statusCode];
      N.logger.fatal('send_reply(): body MUST be a Buffer, String or Null/Undefined.' +
                     ' in ' + env.method);
    }

    // FIXME: Do not forget to filter-out sensitive params upon logging
    // if (req.params.password) req.params.password = '***';
    // if (req.params.password_confirmation) req.params.password_confirmation = '***';

    env.log_request(env);

    //
    // Set Content-Length header if body is given.
    // body is always Buffer, String or Null|Undefined.
    //

    if (Buffer.isBuffer(body)) {
      res.setHeader('Content-Length', body.length);
    } else if (body) {
      // NOTE: Buffer.byteLength() throws TypeError when argument is not a String.
      res.setHeader('Content-Length', Buffer.byteLength(body));
    }

    // set status code and send body (if any)
    res.statusCode = env.status;
    res.end(body);
  });
};

