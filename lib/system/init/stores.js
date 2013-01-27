// Populates N.stores tree
//


"use strict";


// stdlib
var path = require('path');


// 3rd-party
var _       = require('lodash');
var async   = require('async');
var fstools = require('fs-tools');


// internal
var apify       = require('./utils/apify');
var expandTree  = require('./utils/expand_tree');
var Settings    = require('./stores/settings');
var Store       = require('./stores/store');


////////////////////////////////////////////////////////////////////////////////


module.exports = function (N) {
  var schemas = N.config.setting_schemas || {};

  N.wire.on("init:stores", function stores_init(N, cb) {
    N.settings  = new Settings();
    N.stores    = {};

    // KLUDGE: Probably it's better to provide Store right into store init func
    N.settings.createStore = function (schema) {
      return new Store(schema);
    };

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
        store   = init(N);

        if (!store) {
          next(apiPath + " store constructor returns nothing (in: " + file + ")");
          return;
        }

        try {
          // register known keys and theirs default values
          _.each(schemas[apiPath], function (config, key) {
            store.addKnownKey(key, config['type'], config['default']);
          });

          // register store
          N.settings.addStore(apiPath, store);
        } catch (err) {
          next(err);
          return;
        }

        N.stores[apiPath] = store;
        next();
      }, next);
    },

    function (err) {
      if (err) {
        cb(err);
        return;
      }

      expandTree(N.stores);

      N.logger.info('Stores init done ');

      cb();
    });
  });
};
