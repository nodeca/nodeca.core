'use strict';


/*global nodeca, _*/


// stdlib
var crypto = require('crypto');


////////////////////////////////////////////////////////////////////////////////


var PREFIX      = 'sess:';
var SESSION_TTL = 2 * 60 * 60;  // Session timeout in seconds


//  initSession(env) -> Void
//  - env (Object): Request environment (`this` context of handlers)
//
//  Creates new session (based on browser preferences, or on users's profile).
//
function initSession(env) {
  var req = (env.origin.http || env.origin.rpc).req;

  req.sid = crypto.createHash('sha1').update(crypto.randomBytes(128)).digest('hex');
  env.extras.setCookie('sid', req.sid, { maxAge: SESSION_TTL });
}


//  getSession(sid, callback(err, sess)) -> Void
//  - sid (String): Session ID
//  - callback (Function): Executed once session was retreived
//
//  Retreives session from redis backend
//
function getSession(sid, callback) {
  nodeca.runtime.redis.get(PREFIX + sid, function (err, data) {
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
//  - callback (Function): Executed once session was saved/removed
//
//  Saves or removes (if `sess === null`) session from Redis backend
//
function setSession(sid, sess, callback) {
  if (!sess) {
    nodeca.runtime.redis.del(PREFIX + sid, callback);
    return;
  }

  try {
    sess = JSON.stringify(sess);
  } catch (err) {
    callback(err);
    return;
  }

  nodeca.runtime.redis.setex(PREFIX + sid, SESSION_TTL, sess, callback);
}


////////////////////////////////////////////////////////////////////////////////


// Filter middleware that loads session
//
nodeca.filters.before('', { weight: -9000 }, function load_session(params, callback) {
  var env = this, req = (env.origin.http || env.origin.rpc).req;

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

    if (!err && !sess) {
      initSession(env);
    }

    callback(err);
  });
});


// Filter middleware that saves session
//
nodeca.filters.after('', { weight: 9000 }, function save_session(params, callback) {
  var env = this, sid = (this.origin.http || this.origin.rpc).req.sid;

  env.extras.puncher.start('Session save');

  setSession(sid, this.session, function (err) {
    env.extras.puncher.stop();
    callback(err);
  });
});
