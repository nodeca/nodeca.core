// `stores` section processor: read and populate N.stores tree
//


'use strict';


/*global underscore, N*/


// 3rd-party
var _       = underscore;


// internal
var stopwatch  = require('./utils/stopwatch');
var expandTree = require('./utils/expand_tree');


////////////////////////////////////////////////////////////////////////////////


module.exports = function (tmpdir, sandbox, callback) {
  var
  config  = sandbox.config,
  timer   = stopwatch();

  try {
    N.stores = {};

    _.each(config.packages, function (pkgConfig, pkgName) {
      var apiMethods = {};

      if (pkgConfig.stores) {
        pkgConfig.stores.files.forEach(function (pathname) {
          var
          init = pathname.require(),
          func = init(N, pathname.apiPath);

          if (!_.isFunction(func)) {
            throw new Error(pathname + " constructor returned non-Function");
          }

          apiMethods[pathname.apiPath] = func;
        });

        // merge subtree into main tree
        _.extend(N.stores, apiMethods);
      }
    });

    expandTree(N.stores);
  } catch (err) {
    callback(err);
    return;
  } finally {
    N.logger.info('Processed stores section ' + timer.elapsed);
  }

  callback();
};
