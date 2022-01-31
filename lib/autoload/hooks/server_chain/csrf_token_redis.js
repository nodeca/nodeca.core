// - Inject CSRF on HTTP request.
// - Validate CSRF on RPC request.
//

'use strict';


const createToken = require('nodeca.core/lib/app/random_token');

// time is not critical because token is re-generated automatically
const CSRF_TOKEN_TTL = 24 * 60 * 60; // 24 hours


module.exports = function (N) {

  N.wire.before('server_chain:rpc:*', { priority: -55 }, async function csrf_token_check(env) {
    let csrf_token = await N.redis.get(`csrf_token:${env.session_id}`);

    // The particular request can fail, but we send client
    // a new valid token to try again with.

    if (!csrf_token || !createToken.validate(csrf_token)) {
      csrf_token = createToken();
      await N.redis.set(
        `csrf_token:${env.session_id}`, csrf_token,
        'EX', CSRF_TOKEN_TTL,
        'NX'
      );
      throw { code: N.io.INVALID_CSRF_TOKEN, csrf_token };
    }

    if (csrf_token !== env.origin.req.csrf) {
      throw { code: N.io.INVALID_CSRF_TOKEN, csrf_token };
    }
  });
};
