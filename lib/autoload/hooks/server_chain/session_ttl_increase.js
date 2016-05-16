// Increase session TTL for users with enabled cookies.
//
// - 5 min for new session
// - 15 min on second request
// - 4 hours on next requests
//
'use strict';


module.exports = function (N) {
  N.wire.after('server_chain:*', { priority: 75, ensure: true }, function session_ttl_increase(env) {
    // Session is null. Nothing to save.
    if (!env.session) return;

    // Custom TTL is already set by another hook.
    if (env.session_ttl) return;

    switch (env.session.age || 0) {
      case 0:
        env.session_ttl = 5 * 60;
        env.session.age = 1;
        break;
      case 1:
        env.session_ttl = 15 * 60;
        env.session.age = 2;
        break;
      default:
        env.session_ttl = 4 * 60 * 60;
        break;
    }
  });
};
