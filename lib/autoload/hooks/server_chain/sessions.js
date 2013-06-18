// - Load session on request start
// - Save session on request end
//
// uses redis from N.runtime.redis
//

'use strict';


module.exports = function (N) {

  var rnd = require('../../../rnd');

  var PREFIX = 'sess:';
  var SESSION_TTL = 7 * 24 * 60 * 60; // Session timeout in seconds


  //  initSession(env) -> Void
  //  - env (Object): Request environment
  //
  //  Creates new session (based on browser preferences, or on users's profile).
  //
  function initSession(env) {
    var req = env.origin.req;

    env.session_id = rnd();

    // prefill session
    env.session = {
      ip: req.connection.remoteAddress
    };

    return env.session;
  }


  //  getSession(sid, callback(err, sess)) -> Void
  //  - sid (String): Session ID
  //  - callback (Function): Executed once session was retreived
  //
  //  Retreives session from redis backend
  //
  function getSession(sid, callback) {
    N.runtime.redis.get(PREFIX + sid, function (err, data) {
      if (err) {
        callback(err);
        return;
      }

      if (!data) {
        callback(); // No error, no session.
        return;
      }

      try {
        data = JSON.parse(data.toString());
      } catch (err) {
        callback(err);
        return;
      }

      callback(null, data);
    });
  }


  //  setSession(sid, sess, callback(err)) -> Void
  //  - sid (String): Session ID
  //  - sess (Object|Null): Session data
  //
  //  Saves or removes (if `sess === null`) session from Redis backend
  //
  function setSession(sid, sess) {
    if (!sess) {
      N.runtime.redis.del(PREFIX + sid);
      return;
    }

    N.runtime.redis.setex(PREFIX + sid, SESSION_TTL, JSON.stringify(sess));
  }


  //////////////////////////////////////////////////////////////////////////////


  // Loads session on request start
  //
  N.wire.before('server_chain:*', { priority: -80 }, function session_start(env, callback) {
    var req = env.origin.req;

    if (!req) {
      callback();
      return;
    }

    //
    // Get Session ID
    //

    env.session_id = env.extras.getCookie('sid');

    //
    // If no session ID, init new session
    //

    if (!env.session_id) {
      initSession(env);
      callback();
      return;
    }

    //
    // Load existing session
    //

    env.extras.puncher.start('Session load');

    getSession(env.session_id, function (err, sess) {
      env.extras.puncher.stop();

      if (err) {
        callback(err);
        return;
      }

      // get restored session (if exists and ip is same as in request) or init new
      env.session = (sess && req.connection.remoteAddress === sess.ip) ? sess
                  : initSession(env);

      callback();
    });
  });


  // Save session on request end (it's sync, nothing to wait)
  //
  N.wire.after('server_chain:*', { priority: 80, ensure: true }, function session_end(env) {
    if (!env.session_id) {
      return;
    }

    setSession(env.session_id, env.session);

    // Always set because we need to refresh Max-Age.
    env.extras.setCookie('sid', env.session_id, { maxAge: SESSION_TTL });
  });
};