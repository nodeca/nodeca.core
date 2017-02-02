// Prepare http request for server chain
// - fetch POST data
// - unwrap payload (extract CSRF, method, params)


'use strict';


const Promise    = require('bluebird');
const getRawBody = require('raw-body');


const MAX_POST_DATA = '10mb';


module.exports = function (N) {

  N.wire.before('responder:rpc', function* rpc_prepare(env) {
    let req = env.origin.req;
    //
    // invalid request
    //

    if (req.method !== 'POST') {
      env.err = N.io.BAD_REQUEST;
      return;
    }

    //
    // Check request size early by header and terminate immediately for big data
    //
    let length = parseInt((req.headers['content-length'] || '0'), 10);

    if (!length || isNaN(length)) {
      env.err = N.io.LENGTH_REQUIRED;
      return;
    }

    let err = null;

    let data = yield new Promise(resolve => {
      getRawBody(req, { encoding: true, limit: MAX_POST_DATA, length }, (e, data) => {
        err = e;
        resolve(data);
      });
    });

    if (err) {
      if (err.statusCode) env.err = err.statusCode;
      else env.err = { code: N.io.BAD_REQUEST, message: err.message };
      return;
    }

    let payload;

    try {
      payload = JSON.parse(data);
    } catch (__) {
      env.err = { code: N.io.BAD_REQUEST, message: 'Cannot parse post data' };
      return;
    }

    env.params = payload.params || {};

    // save CSRF token if it was sent
    req.csrf = payload.csrf;

    // invalid payload
    if (!payload.version_hash || !payload.method) {
      env.err = N.io.BAD_REQUEST;
      return;
    }

    env.method = payload.method;

    // invalid client version.
    // client will check server version by it's own,
    // so in fact this error is not used by client
    if (payload.version_hash !== N.version_hash) {
      env.err = { code: N.io.BAD_REQUEST, message: 'Client version outdated' };
      return;
    }
  });

};
