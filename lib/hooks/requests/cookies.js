// - load cookies on request start
// - add helper to store cookies
// - autosave cookies on request end
//

'use strict';


module.exports = function (N) {

  var cookie = require('cookie');
  var _ = require('underscore');

  // Parse cookies
  //
  N.wire.before('server:**', { priority: -85 }, function cookies_start(env, callback) {
    var req = (env.origin.http || env.origin.rpc || {}).req;

    req.cookies = {};

    if (req.headers.cookie) {
      try {
        req.cookies = cookie.parse(req.headers.cookie);
      } catch (err) {
        callback(err);
        return;
      }
    }

    // provide a helper that registers cookie to be sent on after filter
    env.extras.setCookie = function (name, value, options) {
      env.extras.setCookie.storage[name] = { value: value, options: options };
    };

    // storage for scheduled cookies to be sent
    env.extras.setCookie.storage = {};

    callback();
  });


  // Send cookies that must be set on the client
  //
  N.wire.after('server:**', { priority: 90, ensure: true }, function cookies_end(env, callback) {
    var cookies = [];

    // prepare list of cookies to be sent
    _.each(env.extras.setCookie.storage, function (data, name) {
      var options = _.extend({ httpOnly: true }, data.options);
      cookies.push(cookie.serialize(name, data.value, options));
    });

    (env.origin.http || env.origin.rpc).res.setHeader('Set-Cookie', cookies);
    callback();
  });
};