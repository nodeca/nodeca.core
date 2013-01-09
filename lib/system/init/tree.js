"use strict";


/*global underscore, N*/


// 3rd-party
var async = require('async');


// internal
var stopwatch = require('./app/utils/stopwatch');


////////////////////////////////////////////////////////////////////////////////


function step(name, func) {
  return function (callback) {
    N.hooks.init.run(name, function (next) {
      func(N, next);
    }, callback);
  };
}


////////////////////////////////////////////////////////////////////////////////


module.exports = function (callback) {
  var timer = stopwatch();

  N.hooks.init.run('tree', function (next) {
    async.series([
      step('models', require('./tree/models')),
      step('stores', require('./tree/stores'))
    ], function (err) {
      N.logger.debug('Trees initialized ' + timer.elapsed);
      next(err);
    });
  }, callback);
};
