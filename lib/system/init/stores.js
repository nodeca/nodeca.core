// Populates N.stores tree
//


"use strict";


/*global N, underscore*/


// stdlib
var path = require("path");


// 3rd-party
var _       = underscore;
var async   = require("async");
var fstools = require("fs-tools");


// internal
var apify       = require("./utils/apify");
var stopwatch   = require("./utils/stopwatch");
var expandTree  = require("./utils/expand_tree");


////////////////////////////////////////////////////////////////////////////////


module.exports = function (callback) {
  var timer = stopwatch();

  N.hooks.init.run("stores", function (next) {
    N.stores = {};

    async.forEach(N.runtime.apps, function (app, next) {
      var storesRoot = path.join(app.root, 'stores');

      fstools.walk(storesRoot, /\.js$/, function (file, stat, next) {
        var apiPath, init, store;

        // skip:
        //
        // - filename starts with underscore, e.g.: /foo/bar/_baz.js
        // - dirname of file starts with underscore, e.g. /foo/_bar/baz.js
        if (file.match(/(^|\/)_/)) {
          next();
          return;
        }

        apiPath = apify(file, storesRoot, /\.js$/);
        init    = require(file);
        store   = init(N, apiPath);

        if (!store) {
          next(apiPath + " store constructor returns nothing (in: " + file + ")");
          return;
        }

        N.stores[apiPath] = store;
        next();
      }, next);
    }, function (err) {
      if (err) {
        next(err);
        return;
      }

      expandTree(N.stores);
      next();
    });
  }, function (err) {
    if (err) {
      callback(err);
      return;
    }

    N.logger.info('Finish stores init ' + timer.elapsed);
    callback();
  });
};
