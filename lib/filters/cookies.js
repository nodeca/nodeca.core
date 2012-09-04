'use strict';


/*global nodeca, _*/


// 3rd-party
var cookie = require('cookie');


////////////////////////////////////////////////////////////////////////////////


// Filter middleware that parses cookies
//
nodeca.filters.before('', { weight: -8500 }, function cookies(params, callback) {
  var req = (this.origin.http || this.origin.rpc || {}).req;

  if (!req) {
    // skip non-http (and non-rpc http) requests
    callback();
    return;
  }

  req.cookies = {};

  if (req.headers.cookie) {
    this.extras.puncher.start('Cookies');

    try {
      req.cookies = cookie.parse(req.headers.cookie);
    } catch (err) {
      callback(err);
      return;
    } finally {
      this.extras.puncher.stop();
    }
  }

  callback();
});
