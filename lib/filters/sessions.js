'use strict';


/*global _*/


// stdlib
var crypto = require('crypto');


// 3rd-party
var cookie = require('cookie');


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


//  delSession(sid, callback(err)) -> Void
//
function delSession(sid, callback) {
  nodeca.runtime.redis.del(PREFIX + sid, callback);
}


////////////////////////////////////////////////////////////////////////////////


// Filter middleware that sets/restores session
//
nodeca.filters.before('', { weight: -9000 }, function sessions(params, callback) {
  var env = this, origin = env.origin.http || env.origin.rpc,
      defaultSession = _.clone(env.session || {}),
      req, res, end, sid, is_new;

  if (!origin) {
    // skip non-http (and non-rpc http) requests
    callback();
    return;
  }

  req = origin.req;
  res = origin.res;
  end = res.end;
  sid = req.cookies.sid;
  is_new = !sid;

  //
  // Save or delete session on end
  // FIXME: Use req.on('end', function () {}) ?
  //

  res.end = function (data, encoding) {
    // restore original method, so we don't need to
    // "preserve" context of execution
    res.end = end;

    var done = function (/* err */) {
      res.end(data, encoding);
    };

    if (is_new && !env.session) {
      done();
      return;
    }

    if (!env.session) {
      delSession(sid, done);
      return;
    }

    setSession(sid, env.session, done);
  };

  //
  // New session - generate new ID
  //

  if (!sid) {
    sid = generateSessionID();
    res.setHeader('Set-Cookie', cookie.serialize('sid', sid, { maxAge: SESSION_TTL }));
    callback();
    return;
  }

  //
  // Load existing session
  //

  env.extras.puncher.start('Session');

  getSession(sid, function (err, sess) {
    env.session = sess || defaultSession;

    if (!sess) {
      sid = generateSessionID();
      res.setHeader('Set-Cookie', cookie.serialize('sid', sid, { maxAge: SESSION_TTL }));
    }

    env.extras.puncher.stop();
    callback(err);
  });
});
