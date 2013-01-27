// `server` section processor: read methods handlers & assign to N.wire
//


'use strict';


/*global N*/


// 3rd-party
var _ = require('lodash');


// internal
var stopwatch  = require('../utils/stopwatch');


////////////////////////////////////////////////////////////////////////////////


module.exports = function (tmpdir, sandbox, callback) {
  var
  config  = sandbox.config,
  timer   = stopwatch();

  try {
    _.each(config.packages, function (pkgConfig /*, pkgName*/) {

      if (pkgConfig.server) {
        pkgConfig.server.files.forEach(function (pathObj) {
          // load & run server method consctuctor
          pathObj.require()(N, 'server:' + pathObj.apiPath);
        });
      }
    });
  } catch (err) {
    callback(err);
    return;
  } finally {
    N.logger.info('Processed server section ' + timer.elapsed);
  }

  callback();
};
