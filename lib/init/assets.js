"use strict";


/*global nodeca, _*/


// 3rd-party
var async   = require('nlib').Vendor.Async;
var fstools = require('nlib').Vendor.FsTools;


// internal
var bundle  = require('./assets/bundle');
var mincer  = require('./assets/mincer');


////////////////////////////////////////////////////////////////////////////////


module.exports = function (next) {
  var tmp;

  try {
    tmp = fstools.tmpdir('/tmp/nodeca.XXXXX');
  } catch (err) {
    next(err);
    return;
  }

  async.series([
    async.apply(fstools.mkdir, tmp),
    bundle.apply(tmp),
    mincer.apply(tmp),
  ], function (err/*, results*/) {
    next(err);
  });
};
