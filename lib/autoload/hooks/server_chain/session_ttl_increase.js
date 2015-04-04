// Increase session TTL for users with enabled cookies
// using 'general_session_expire_hours' global setting.
//
// Default session TTL is quite short because of bots which not accept cookies
// and create new session on each request.


'use strict';


module.exports = function (N) {
  N.wire.before('server_chain:*', { priority: -65 }, function session_ttl_increase(env, callback) {
    if (!env.session_id) {
      // New unsaved session. We accept only saved and reused sessions here.
      callback();
      return;
    }

    if (env.session_ttl) {
      // Custom TTL is already set by another hook.
      callback();
      return;
    }

    N.settings.get('general_session_expire_hours', function (err, expireHours) {
      if (err) {
        callback(err);
        return;
      }

      if (expireHours === 0) {
        // Should not change anything. Leave default session TTL.
        callback();
        return;
      }

      env.session_ttl = expireHours * 60 * 60;
      callback();
    });
  });
};
