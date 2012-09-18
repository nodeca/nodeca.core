'use strict';


/*global nodeca, _*/


// internal
var rnd = require('../rnd');


////////////////////////////////////////////////////////////////////////////////


nodeca.filters.before('', { weight: -75 }, function csrf_protection(params, callback) {
  if (!this.origin.rpc) {
    callback();
    return;
  }

  if (!this.session.csrf) {
    this.session.csrf = this.runtime.csrf = rnd();
    callback();
    return;
  }

  if (this.session.csrf !== this.origin.rpc.req.csrf) {
    callback({
      statusCode: 401,
      message:    'CSRF token mismatch'
    });
    return;
  }

  this.runtime.csrf = this.session.csrf;
  callback();
});
