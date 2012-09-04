'use strict';


/*global nodeca, _*/


// stdlib
var crypto = require('crypto');


////////////////////////////////////////////////////////////////////////////////


function sid() {
  return crypto.createHash('sha1').update(crypto.randomBytes(128)).digest('hex');
}


////////////////////////////////////////////////////////////////////////////////


// Filter middleware that sets/restores session
//
nodeca.filters.before('', { weight: -8000 }, function renderer(params, callback) {
  var origin = this.origin.http || this.origin.rpc;

  if (!origin) {
    // skip non-http (and non-rpc http) requests
    callback();
    return;
  }

  // Not implemented yet
  callback();
  return;

  this.extras.puncher.start('Session');


  this.extras.puncher.stop();
  callback();
});
