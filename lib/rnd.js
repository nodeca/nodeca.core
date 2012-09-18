'use strict';


// stdlib
var crypto = require('crypto');


////////////////////////////////////////////////////////////////////////////////


// rnd() -> String
//
// returns random generated string
//
module.exports = function rnd() {
  return crypto.createHash('sha1').update(crypto.randomBytes(128)).digest('hex');
};
