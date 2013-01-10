// `server` section processor: read and populate N.server tree
//


'use strict';


/*global underscore, N*/


// 3rd-party
var _ = underscore;


// internal
var stopwatch  = require('./utils/stopwatch');
var expandTree = require('./utils/expand_tree');


////////////////////////////////////////////////////////////////////////////////


module.exports = function (tmpdir, sandbox, callback) {
  var
  config  = sandbox.config,
  timer   = stopwatch();

  try {
    N.server = {};

    _.each(config.packages, function (pkgConfig, pkgName) {
      var apiMethods = {};

      if (pkgConfig.server) {
        pkgConfig.server.files.forEach(function (pathname) {
          var
          init = pathname.require(),
          func = init(N, pathname.apiPath);

          if (!_.isFunction(func)) {
            throw new Error(pathname + " constructor returned non-Function");
          }

          apiMethods[pathname.apiPath] = func;
        });

        // merge subtree into main tree
        _.extend(N.server, apiMethods);
      }
    });

    expandTree(N.server);
  } catch (err) {
    callback(err);
    return;
  } finally {
    N.logger.info('Processed server section ' + timer.elapsed);
  }

  callback();
};
