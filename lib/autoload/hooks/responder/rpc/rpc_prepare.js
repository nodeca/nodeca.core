// Prepare http request for server chain
// - fetch POST data
// - unwrap payload (extract CSRF, method, params)


'use strict';


const MAX_POST_DATA = 10 * 1000 * 1024; // Max post data in bytes


module.exports = function (N) {

  N.wire.before('responder:rpc', function rpc_prepare(env, callback) {
    let req = env.origin.req;

    //
    // invalid request
    //

    if (req.method !== 'POST') {
      env.err = N.io.BAD_REQUEST;
      callback();
      return;
    }

    //
    // Check request size early by header and terminate immediately for big data
    //
    let length = req.headers['content-length'];

    if (!length) {
      env.err = N.io.LENGTH_REQUIRED;
      callback();
      return;
    }

    if (length > MAX_POST_DATA) {
      env.err = { code: N.io.BAD_REQUEST, message: 'Too big post data' };
      callback();
      return;
    }

    //
    // start harvesting POST data
    //
    let chunks = [],
        chunksLength = 0;

    req.on('data', chunk => {
      chunks.push(chunk);
      chunksLength += chunk.length;

      if (chunksLength > MAX_POST_DATA) {
        // max allowed post data reached, drop request.
        req.removeAllListeners();
        req.connection.destroy();
      }
    });

    //
    // when done (on success) process POST data and handle request
    //

    req.on('end', () => {
      let payload;

      try {
        payload = JSON.parse(Buffer.concat(chunks).toString());
        chunks = [];
      } catch (err) {
        env.err = { code: N.io.BAD_REQUEST, message: 'Cannot parse post data' };
        callback();
        return;
      }

      env.params = payload.params || {};

      // save CSRF token if it was sent
      req.csrf = payload.csrf;

      // invalid payload
      if (!payload.version_hash || !payload.method) {
        env.err = N.io.BAD_REQUEST;
        callback();
        return;
      }

      env.method = payload.method;

      // invalid client version.
      // client will check server version by it's own,
      // so in fact this error is not used by client
      if (payload.version_hash !== N.version_hash) {
        env.err = { code: N.io.BAD_REQUEST, message: 'Client version outdated' };
        callback();
        return;
      }

      callback();
    });
  });
};
