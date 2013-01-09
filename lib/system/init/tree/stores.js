// `stores` section processor: read and populate N.stores tree
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

  N.stores = {};

  async.forEach(N.runtime.apps, function (app, next) {
    var storesRoot = path.join(app.root, 'stores');

    fstools.walk(storesRoot, /\.js$/, function (file, stat, next) {
      var
      apiPath = apify(file, storesRoot, /\.js$/),
      init    = require(file);

      N.stores[apiPath] = init(N, apiPath);
      next();
    }, next);
  }, function (err) {
    if (err) {
      callback(err);
      return;
    }

    expandTree(N.stores);

    N.logger.info('Processed stores section ' + timer.elapsed);
    callback();
  });
};
