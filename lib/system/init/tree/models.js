// `models` section processor: read and populate N.models tree
//


"use strict";


/*global underscore*/


// stdlib
var path = require("path");


// 3rd-party
var _       = underscore;
var async   = require("async");
var fstools = require("fs-tools");


// internal
var apify       = require("../app/utils/apify");
var stopwatch   = require("../app/utils/stopwatch");
var expandTree  = require("../app/utils/expand_tree");


////////////////////////////////////////////////////////////////////////////////


module.exports = function (N, callback) {
  var timer = stopwatch();

  N.models = {};

  async.forEach(N.runtime.apps, function (app, next) {
    var modelsRoot = path.join(app.root, 'models');

    fstools.walk(modelsRoot, /\.js$/, function (file, stat, next) {
      var
      apiPath = apify(file, modelsRoot, /\.js$/),
      init    = require(file),
      model   = init(N, apiPath);

      N.hooks.models.run(apiPath, model, null, function (err) {
        if (err) {
          next(err);
          return;
        }

        if (!_.isFunction(model.__init__)) {
          N.models[apiPath] = model;
        } else {
          try {
            N.models[apiPath] = model.__init__();
          } catch (err) {
            next(err);
            return;
          }
        }

        next();
      });
    }, next);
  }, function (err) {
    if (err) {
      callback(err);
      return;
    }

    expandTree(N.models);

    N.logger.info('Processed models section ' + timer.elapsed);
    callback();
  });
};
