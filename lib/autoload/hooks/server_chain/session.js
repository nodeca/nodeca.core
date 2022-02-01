// - Load session on request start.
// - Create new session if not exists or expired.
// - Save session on request end.
//
// It uses Redis to store session data.
//
'use strict';


const createToken = require('nodeca.core/lib/app/random_token');
const COOKIE_MAXAGE_LIKE_FOREVER = 10 * 365 * 24 * 60 * 60; // 10 years.

function validateSession(session) {
  const s = String(session);
  // Session can be
  //
  // - 20-bytes hex (40 chars) for guests
  // - 'm' + above for members
  //
  // We do not need very strict check. Only filter manually-typed garbage.
  //
  return createToken.validate(s) || createToken.validate(s.slice(1));
}

module.exports = function (N) {

  // Load session id or create if not exists
  //
  N.wire.before('server_chain:*', { priority: -80 }, async function session_load(env) {
    let sid = env.extras.getCookie('sid');

    env.session_just_created = false;

    // No saved session or bad key name.
    if (!sid || !validateSession(sid)) {
      sid = createToken();
      env.session_just_created = true;
    }

    env.session_id = sid;
  });


  // Set cookies
  //
  N.wire.after('server_chain:*', { priority: 80, ensure: true }, function session_save(env) {
    // Store cookies in 2 cases:
    // 1. Was not available initially
    // 2. Session id changed by login
    if (env.session_just_created || env.extras.getCookie('sid') !== env.session_id) {
      env.extras.setCookie(
        'sid',
        env.session_id,
        { maxAge: COOKIE_MAXAGE_LIKE_FOREVER }
      );
    }
  });
};


module.exports.validateSession = validateSession;
