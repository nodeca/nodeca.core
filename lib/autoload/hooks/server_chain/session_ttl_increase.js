// Increase session TTL for users with enabled cookies
// using 'general_session_expire_hours' global setting.
//
// Default session TTL is quite short because of bots which not accept cookies
// and create new session on each request.


'use strict';


module.exports = function (N) {
  N.wire.before('server_chain:*', { priority: -65 }, function* session_ttl_increase(env) {
    // New unsaved session. We accept only saved and reused sessions here.
    if (!env.session_id) return;

    // Custom TTL is already set by another hook.
    if (env.session_ttl) return;

    let expireHours = yield N.settings.get('general_session_expire_hours');

    // Should not change anything. Leave default session TTL.
    if (expireHours === 0) return;

    env.session_ttl = expireHours * 60 * 60;

  });
};
