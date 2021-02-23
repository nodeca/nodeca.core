// - Load session on request start.
// - Create new session if not exists or expired.
// - Save session on request end.
//
// It uses Redis to store session data.
//
'use strict';


const _           = require('lodash');
const createToken = require('nodeca.core/lib/app/random_token');


// 4 hours - default TTL for new session. It's so short because of bots which
// not accept cookies and create new session on each request. For humans
// with cookies enabled TTL should be increased in another hook.
const SESSION_DEFAULT_TTL = 4 * 60 * 60;

const COOKIE_MAXAGE_LIKE_FOREVER = 10 * 365 * 24 * 60 * 60; // 10 years.
const COOKIE_EXPIRES_IN_THE_PAST = new Date('Thu, 01 Jan 1970 00:00:00 GMT');


module.exports = function (N) {

  // Load session data from Redis if user has valid sid cookie.
  //
  N.wire.before('server_chain:*', { priority: -80 }, async function session_load(env) {
    let sid = env.extras.getCookie('sid');

    // No saved session.
    if (_.isEmpty(sid)) return;

    let rawData = await N.redis.get('sess:' + sid);

    // Session is not found.
    if (!rawData) return;

    let session;

    try {
      session = JSON.parse(rawData);
    } catch (__) {
      // Broken data in session store - reset session.
      return;
    }

    env.session_id  = sid;
    env.session_ttl = null; // i.e. use default; may be overridden later.
    env.session     = session;
  });


  // Create new guest session if none is loaded.
  //
  N.wire.before('server_chain:*', { priority: -70 }, function session_new(env) {
    if (env.session) {
      // Using existent session.
      return;
    }

    env.session_id  = null; // i.e. generate new; may be overridden later.
    env.session_ttl = null; // i.e. use default; may be overridden later.
    env.session     = {};
  });


  // Save session when it is *not* null.
  // Note, we do *not* wait for Redis callback.
  //
  N.wire.after('server_chain:*', { priority: 80, ensure: true }, function session_save(env) {
    if (!env.session) {
      // Session is null. Nothing to save.
      return;
    }

    env.session_id  = env.session_id  || createToken();
    env.session_ttl = env.session_ttl || SESSION_DEFAULT_TTL;

    N.redis.setex(
      'sess:' + env.session_id,
      env.session_ttl,
      JSON.stringify(env.session)
    );

    if (env.session_id !== env.extras.getCookie('sid')) {
      // Set 'sid' cookie.
      env.extras.setCookie('sid', env.session_id, { maxAge: COOKIE_MAXAGE_LIKE_FOREVER });
    }
  });


  // Delete session when it is null.
  // Note, we do *not* wait for Redis callback.
  //
  N.wire.after('server_chain:*', { priority: 80, ensure: true }, function session_delete(env) {
    // Session is not null. Do nothing here.
    if (env.session) return;

    if (env.session_id) {
      // Delete session data from Redis.
      N.redis.del('sess:' + env.session_id);
    }

    if (!_.isEmpty(env.extras.getCookie('sid'))) {
      // Drop 'sid' cookie.
      env.extras.setCookie('sid', '', { expire: COOKIE_EXPIRES_IN_THE_PAST });
    }
  });
};
