// `server` section processor: read methods handlers & assign to N.wire
//


'use strict';


// 3rd-party
var _ = require('lodash');


// internal
var stopwatch = require('../utils/stopwatch');
var findPaths = require('./utils/find_paths');


////////////////////////////////////////////////////////////////////////////////


module.exports = function (sandbox, callback) {
  var N = sandbox.N
    , config  = sandbox.config
    , timer   = stopwatch();

  try {
    _.each(config.packages, function (pkgConfig /*, pkgName*/) {

      findPaths(pkgConfig.server, function (fsPath, apiPath) {
        // load & run server method consctuctor
        // by default, match all responders (**:http and **:rpc)
        require(fsPath)(N, 'server:' + apiPath + ':*');
      });
    });
  } catch (err) {
    callback(err);
    return;
  } finally {
    N.logger.info('Processed server section %s', timer.elapsed);
  }

  callback();
};
