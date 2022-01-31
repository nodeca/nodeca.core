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

module.exports.validate = function validate(str) {
  return /^[0-9A-F]{40}$/i.test(String(str));
};
