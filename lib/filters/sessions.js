'use strict';


/*global nodeca, _*/


// stdlib
var crypto = require('crypto');


////////////////////////////////////////////////////////////////////////////////


var PREFIX      = 'sess:';
var SESSION_TTL = 2 * 60 * 60;  // Session timeout in seconds


// generates random session ID
//
function generateSessionID() {
  return crypto.createHash('sha1').update(crypto.randomBytes(128)).digest('hex');
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
//
function setSession(sid, sess, callback) {
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
  var env = this, origin = env.origin.http || env.origin.rpc,
      req, res, end, sid;

  req = origin.req;
  res = origin.res;
  end = res.end;
  sid = req.sid = req.cookies.sid;

  //
  // New session - generate new ID
  //

  if (!sid) {
    sid = req.sid = generateSessionID();
    env.extras.setCookie('sid', sid, { maxAge: SESSION_TTL });
    callback();
    return;
  }

  //
  // Load existing session
  //

  env.extras.puncher.start('Session');

  getSession(sid, function (err, sess) {
    if (!!sess) {
      env.session = sess;
    } else {
      sid = req.sid = generateSessionID();
      env.extras.setCookie('sid', sid, { maxAge: SESSION_TTL });
    }

    env.extras.puncher.stop();
    callback(err);
  });
});


// Filter middleware that saves session
//
nodeca.filters.after('', { weight: 9000 }, function save_session(params, callback) {
  var sid = (this.origin.http || this.origin.rpc).req.sid;

  if (!this.session) {
    nodeca.runtime.redis.del(PREFIX + sid, callback);
    return;
  }

  setSession(sid, this.session, callback);
});
