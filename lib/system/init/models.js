// Populates N.models tree
//


"use strict";


// stdlib
var path = require("path");


// 3rd-party
var _       = require('underscore');
var async   = require("async");
var fstools = require("fs-tools");


// internal
var apify       = require("./utils/apify");
var stopwatch   = require("./utils/stopwatch");
var expandTree  = require("./utils/expand_tree");


////////////////////////////////////////////////////////////////////////////////


module.exports = function (N, callback) {
  var timer = stopwatch();

  N.wire.on("init:models", function models_init(N, cb) {
    N.models = {};

    async.forEach(N.runtime.apps, function (app, next) {
      var modelsRoot = path.join(app.root, 'models');

      fstools.walk(modelsRoot, /\.js$/, function (file, stat, next) {
        var collectionName, init, model;

        // skip:
        //
        // - filename starts with underscore, e.g.: /foo/bar/_baz.js
        // - dirname of file starts with underscore, e.g. /foo/_bar/baz.js
        if (file.match(/(^|\/)_/)) {
          next();
          return;
        }

        collectionName  = apify(file, modelsRoot, /\.js$/);
        init  = require(file);
        model = init(N, collectionName);

        if (!model) {
          next(collectionName +
               " model constructor returns nothing (in: " + file + ")");
          return;
        }

        if (!_.isFunction(model.__init__)) {
          N.models[collectionName] = model;
        } else {
          try {
            N.models[collectionName] = model.__init__();
          } catch (err) {
            next(err);
            return;
          }
        }

        next();
      }, next);
    },

    function (err) {
      if (err) {
        cb(err);
        return;
      }

      expandTree(N.models);

      N.logger.info('Finish models init ' + timer.elapsed);

      cb();
    });
  });

  N.wire.emit('init:models', N, callback);
};
