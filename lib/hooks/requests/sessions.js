// - Load session on request start
// - Save session on request end
//
// uses redis from N.runtime.redis
//

'use strict';


module.exports = function (N) {

  var rnd = require('../../rnd');
  var PREFIX      = 'sess:';
  var SESSION_TTL = 2 * 60 * 60;  // Session timeout in seconds


  //  initSession(env) -> Void
  //  - env (Object): Request environment (`this` context of handlers)
  //
  //  Creates new session (based on browser preferences, or on users's profile).
  //
  function initSession(env) {
    var req = (env.origin.http || env.origin.rpc).req;

    req.sid = rnd();
    env.extras.setCookie('sid', req.sid, {
      maxAge: SESSION_TTL,
      path:   '/'
    });

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
        callback();
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


  ////////////////////////////////////////////////////////////////////////////////


  // Loads session on request start
  //
  N.wire.before('server:**', { priority: -80 }, function load_session(env, callback) {
    var req = (env.origin.http || env.origin.rpc).req;

    if (!req || -1 < env.skip.indexOf('sessions')) {
      callback();
      return;
    }

    //
    // Get Session ID
    //

    req.sid = req.cookies.sid;

    //
    // If no session ID, init new session
    //

    if (!req.sid) {
      initSession(env);
      callback();
      return;
    }

    //
    // Load existing session
    //

    env.extras.puncher.start('Session load');

    getSession(req.sid, function (err, sess) {
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


  // Save session on request end
  //
  N.wire.after('server:**', { priority: 90, ensure: true }, function save_session(env, callback) {
    var req = (env.origin.http || env.origin.rpc).req;

    if (!req || !req.sid || -1 < env.skip.indexOf('sessions')) {
      callback();
      return;
    }

    setSession(req.sid, env.session);
    callback();
  });

};