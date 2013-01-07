'use strict';


/*global N, underscore*/


// 3rd-party
var cookie = require('cookie');
var _ = underscore;


////////////////////////////////////////////////////////////////////////////////


// Filter middleware that parses cookies
//
N.filters.before('', { weight: -85 }, function get_cookies(params, callback) {
  var env = this, req = (env.origin.http || env.origin.rpc || {}).req;

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


// Filter that send cookies that must be set on the client
//
N.filters.ensure('', { weight: 90 }, function set_cookies(params, callback) {
  var cookies = [];

  // prepare list of cookies to be sent
  _.each(this.extras.setCookie.storage, function (data, name) {
    var options = _.extend({ httpOnly: true }, data.options);
    cookies.push(cookie.serialize(name, data.value, options));
  });

  (this.origin.http || this.origin.rpc).res.setHeader('Set-Cookie', cookies);
  callback();
});
