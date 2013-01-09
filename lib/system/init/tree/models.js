// `models` section processor: read and populate N.models tree
//


'use strict';


/*global underscore, N*/


// 3rd-party
var _     = underscore;
var async = require('async');


// internal
var stopwatch  = require('./utils/stopwatch');
var expandTree = require('./utils/expand_tree');


////////////////////////////////////////////////////////////////////////////////


module.exports = function (tmpdir, sandbox, callback) {
  var
  config  = sandbox.config,
  timer   = stopwatch();

  try {
    N.models = {};

    _.each(config.packages, function (pkgConfig, pkgName) {
      var apiMethods = {};

      if (pkgConfig.models) {
        pkgConfig.models.files.forEach(function (pathname) {
          var
          init = pathname.require(),
          func = init(N, pathname.apiPath);

          if (!_.isFunction(func)) {
            throw new Error(pathname + " constructor returned non-Function");
          }

          apiMethods[pathname.apiPath] = func;
        });

        // merge subtree into main tree
        _.extend(N.models, apiMethods);
      }
    });

  } catch (err) {
    callback(err);
    return;
  } finally {
    N.logger.info('Processed models section ' + timer.elapsed);
  }

  async.forEach(_.keys(N.models), function (apiPath, next) {
    var model = N.models[apiPath];

    N.hooks.models.emit(apiPath, model, function (err) {
      if (err) {
        next(err);
        return;
      }

      try {
        if (model.__init__) {
          N.models[apiPath] = model.__init__();
        }
      } catch (err) {
        next(err);
        return;
      }

      next();
    });
  }, function (err) {
    if (err) {
      callback(err);
      return;
    }

    expandTree(N.models);
    callback();
  });
};
