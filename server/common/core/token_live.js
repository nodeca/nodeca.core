// - Create new token on client request
// - Inject token to runtime for http requests
// - Save token or update TLL
//
'use strict';


const createToken = require('nodeca.core/lib/app/random_token');


const MAX_LIVE_TOKEN_TTL = 1 * 60 * 60; // 1 hour


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});


  // Create new token
  //
  N.wire.on(apiPath, function token_live_create(env) {
    // If no session - skip
    if (!env.session) return;

    let token = createToken();

    env.session.token_live = token;
    env.res.token_live = token;
  });


  // Inject token to runtime for http requests
  //
  N.wire.after('server_chain:http:*', function token_live_inject(env) {
    // If no token or no session - skip
    if (!env.session || !env.session.token_live) return;

    env.runtime.token_live = env.session.token_live;
  });


  // Save token or update TLL
  //
  N.wire.after('server_chain:*', { priority: 90, ensure: true }, function* token_live_save(env) {
    // If no token or no session - skip
    if (!env.session || !env.session.token_live) return;

    let ttl = Math.min(MAX_LIVE_TOKEN_TTL, env.session_ttl);

    // - save token here because we couldn't know session_id earlier
    // - if same record already exists redis will only update TTL
    yield N.redis.setexAsync('token_live:' + env.session.token_live, ttl, env.session_id);
  });
};
