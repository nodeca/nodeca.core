// Prepare http request for server chain
// - fetch POST data
// - unwrap payload (extract CSRF, method, params)


'use strict';


var qs = require('qs');
var _           = require('lodash');


var MAX_POST_DATA = 10 * 1000 * 1024; // Max post data in bytes


module.exports = function (N) {

  var logger = N.logger.getLogger('rpc');

  function log(env) {
    var err = env.err
      , req = env.origin.req
      , level = 'info'
      , message = 'OK';

    if (err) {
      message = err.message || JSON.stringify(err);

      if (!err.code || N.io.APP_ERROR <= err.code) {
        level = 'fatal';
      } else if (N.io.BAD_REQUEST <= err.code && N.io.APP_ERROR > err.code) {
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

  N.wire.before('responder:rpc', function rpc_prepare(env, callback) {
    var req = env.origin.req
      , data = '';

    env.log_request = log;

    //
    // invalid request
    //

    if ('POST' !== req.method) {
      env.err = N.io.BAD_REQUEST;
      callback();
      return;
    }

    //
    // Set encoding, to glue data chunks as strings.
    // In other case you need to work with buffer, to avoid
    // breaking unicode characters.
    //
    // We don't expect rpc to work with big uploads, so, strings are enougth
    //

    req.setEncoding('utf8');

    //
    // start harvesting POST data
    //

    req.on('data', function (chunk) {
      if (MAX_POST_DATA < Buffer.byteLength(data += chunk)) {
        // max allowed post data reached, drop request.
        req.removeAllListeners('data');
        req.removeAllListeners('end');

        env.err = { code: N.io.BAD_REQUEST, message: 'Too big post data' };

        // Force destroy incoming connection
        req.connection.destroy();

        callback();
      }
    });

    //
    // when done (on success) process POST data and handle request
    //

    req.on('end', function () {
      var payload = _.defaults(qs.parse(data), req.query)
        , params  = payload.params || {};

      env.params = params;

      // save CSRF token if it was sent
      req.csrf = payload.csrf;

      // invalid payload
      if (!payload.version || !payload.method) {
        env.err = N.io.BAD_REQUEST;
        callback();
        return;
      }

      env.method = payload.method;

      // invalid client version.
      // client will check server version by it's own,
      // so in fact this error is not used by client
      if (payload.version !== N.runtime.version) {
        env.err = N.io.BAD_REQUEST;
        callback();
        return;
      }

      callback();
    });
  });
};
