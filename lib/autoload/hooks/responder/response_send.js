// Send reply to client.
// We expect, to have:
// - env.res
//   - body
//   - headers


'use strict';


const http        = require('http');
const compression = require('compression')();


////////////////////////////////////////////////////////////////////////////////

// Note, we also listen `responder:bin` to unify logging & error responding

const CHANNELS = [ 'responder:http', 'responder:rpc', 'responder:bin' ];

module.exports = function (N) {

  N.wire.after(CHANNELS.slice(0, -1), { priority: 100 }, function response_compress(env, callback) {
    // Assign compression (to http/rpc only, server_bin can have separate settings).
    compression(env.origin.req, env.origin.res, callback);
  });


  function report_error(env, message, extra) {
    if (extra) message = `message [${JSON.stringify(extra)}]`;

    N.logger.error('send_reply: %s\n%s', message, JSON.stringify({
      ip:        env.req.ip,
      url:       env.origin.req.url,
      request:   env.origin.req.method,
      responder: env.req.type,
      apiPath:   env.method,
      params:    env.params
    }, null, 2));
  }


  N.wire.after(CHANNELS, { priority: 100 }, function response_send(env) {
    let res = env.origin.res,
        headers = env.headers,
        body = env.body,
        statusCode;

    // If someone already sent reply - do nothing
    if (res.finished) return;

    // Skip headers modify if has been sent (by custom sender)
    if (!res.headersSent) {
      //
      // Set some obligatory headers
      //

      headers.Server = headers.Server || 'Sansun Calakci';
      // added by node automatically
      // headers['Date'] = headers['Date'] || new Date).toUTCString();

      //
      // Remove Accept-Ranges if it wasn't explicitly set
      //

      if (!headers['Accept-Ranges']) {
        try {
          res.removeHeader('Accept-Ranges');
        } catch (err) {
          report_error(env, err.stack);
        }
      }

      //
      // set headers
      //

      for (let [ name, value ] of Object.entries(headers)) {
        /* eslint-disable max-depth */
        if (value === null) {
          try {
            res.removeHeader(name);
          } catch (err) {
            report_error(env, err.stack, name);
          }
          continue;
        }

        try {
          res.setHeader(name, value);
        } catch (err) {
          report_error(env, err.stack, [ name, value ]);
        }
      }
    }


    //
    // When body is given, it MUST be a Buffer or a String
    // (this error should not happen)
    //

    if (body && !Buffer.isBuffer(body) && typeof body !== 'string') {
      statusCode = N.io.APP_ERROR;
      body       = http.STATUS_CODES[statusCode];
      report_error(env, 'body MUST be a Buffer, String or Null/Undefined');
    }

    // set status code and send body (if any)
    res.statusCode = env.status;
    res.end(body);
  });
};
