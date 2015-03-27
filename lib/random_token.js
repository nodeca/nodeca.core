'use strict';


// stdlib
var randomBytes = require('crypto').randomBytes;


////////////////////////////////////////////////////////////////////////////////


// rnd() -> String
//
// returns random generated string
//
module.exports = function rnd() {
  return randomBytes(20).toString('hex');
};
