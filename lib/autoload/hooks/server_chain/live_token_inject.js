// - create token for live messaging if not exists
// - update TTL in redis if exists
// - inject token to page
//
'use strict';


var createToken = require('nodeca.core/lib/random_token');


module.exports = function (N) {

  // Generate new token if not exists before save session (`env.session_id` may be null)
  //
  N.wire.before('server_chain:*', { priority: -60 }, function token_live_create(env, callback) {
    // If no session - skip
    if (!env.session) {
      callback();
      return;
    }

    // Create new token if not exisis
    env.session.token_live = env.session.token_live || createToken();

    callback();
  });


  // Save relation between live token and session after session save (`env.session_id` is exactly defined)
  // and expose token to page runtime
  //
  N.wire.after('server_chain:*', { priority: 90 }, function token_live_store(env, callback) {
    // If no session - skip
    if (!env.session) {
      callback();
      return;
    }

    env.runtime.token_live = env.session.token_live;

    // Save token or update TTL
    N.redis.setex('token_live:' + env.session.token_live, env.session_ttl, env.session_id, callback);
  });
};
