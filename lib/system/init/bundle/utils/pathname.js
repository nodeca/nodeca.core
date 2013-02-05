// Pathname class. Used to simplify work with files.
//


'use strict';


// stdlib
var fs   = require('fs');
var path = require('path');


// 3rd-party
var _ = require('lodash');


////////////////////////////////////////////////////////////////////////////////


function Pathname(pathname, options) {
  this.pathname =  String(pathname);
  this.extname  =  path.extname(this.pathname);
  this.dirname  =  path.dirname(this.pathname);

  _.extend(this, options);
}


Pathname.prototype.toString = function toString() {
  return this.pathname;
};


Pathname.prototype.read = function (callback) {
  fs.readFile(this.pathname, 'utf8', callback);
};


Pathname.prototype.readSync = function () {
  return fs.readFileSync(this.pathname, 'utf8');
};


Pathname.prototype.require = function () {
  return require(this.pathname);
};


////////////////////////////////////////////////////////////////////////////////


module.exports = Pathname;
