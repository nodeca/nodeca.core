// - Load session on request start.
// - Create new session if not exists or expired.
// - Save session on request end.
//
// It uses Redis to store session data.


'use strict';


var _   = require('lodash');
var rnd = require('../../../rnd');


var SESSION_REDIS_PREFIX  = 'sess:';

// 1 hour - default TTL for new session. It's so short because of bots which
// not accept cookies and create new session on each request. For humans
// with cookies enabled TTL should be increased in another hook.
var NEW_SESSION_REDIS_TTL = 1 * 60 * 60;

var COOKIE_MAXAGE_LIKE_FOREVER = 10 * 365 * 24 * 60 * 60; // 10 years.
var COOKIE_EXPIRES_IN_THE_PAST = new Date('Thu, 01 Jan 1970 00:00:00 GMT');


module.exports = function (N) {

  // Load session data from Redis if user has valid sid cookie.
  //
  N.wire.before('server_chain:*', { priority: -80 }, function load_session(env, callback) {
    var sid = env.extras.getCookie('sid');

    if (_.isEmpty(sid)) {
      // No saved session.
      callback();
      return;
    }

    env.extras.puncher.start('Session load');

    N.runtime.redis.get(SESSION_REDIS_PREFIX + sid, function (err, rawData) {
      var session;

      env.extras.puncher.stop();

      if (!rawData) {
        // Session is not found.
        callback();
        return;
      }
      
      try {
        session = JSON.parse(rawData);
      } catch (err) {
        // Broken data in session store - reset session.
        callback();
        return;
      }

      // Refuse session if IP address not matches.
      if (session.ip !== env.request.ip) {
        callback();
        return;
      }

      env.session_id  = sid;
      env.session_ttl = null; // i.e. use default; may be overridden later.
      env.session     = session;
      callback();
    });
  });


  // Create new guest session if none is loaded.
  //
  N.wire.before('server_chain:*', { priority: -60 }, function new_session(env) {
    if (env.session) {
      // Using existent session.
      return;
    }

    env.session_id  = null; // i.e. generate new; may be overridden later.
    env.session_ttl = null; // i.e. use default; may be overridden later.
    env.session     = { ip: env.request.ip };
  });


  // Save session when it is *not* null.
  // Note, we do *not* wait for Redis callback.
  //
  N.wire.after('server_chain:*', { priority: 80, ensure: true }, function save_session(env) {
    if (!env.session) {
      // Session is null. Nothing to save.
      return;
    }

    env.session_id  = env.session_id  || rnd();
    env.session_ttl = env.session_ttl || NEW_SESSION_REDIS_TTL;

    N.runtime.redis.setex(
      SESSION_REDIS_PREFIX + env.session_id
    , env.session_ttl
    , JSON.stringify(env.session)
    );

    if (env.session_id !== env.extras.getCookie('sid')) {
      // Set 'sid' cookie.
      env.extras.setCookie('sid', env.session_id, { maxAge: COOKIE_MAXAGE_LIKE_FOREVER });
    }
  });


  // Delete session when it is null.
  // Note, we do *not* wait for Redis callback.
  //
  N.wire.after('server_chain:*', { priority: 80, ensure: true }, function delete_session(env) {
    if (env.session) {
      // Session is not null. Do nothing here.
      return;
    }

    if (env.session_id) {
      // Delete session data from Redis.
      N.runtime.redis.del(SESSION_REDIS_PREFIX + env.session_id);
    }

    if (!_.isEmpty(env.extras.getCookie('sid'))) {
      // Drop 'sid' cookie.
      env.extras.setCookie('sid', '', { expire: COOKIE_EXPIRES_IN_THE_PAST });
    }
  });
};
