// Load stores, their schemas & init N.settings
//


"use strict";


// stdlib
var path = require('path');


// 3rd-party
var _       = require('lodash');
var fstools = require('fs-tools');


// internal
var apify       = require('../../../system/init/utils/apify');
var Settings    = require('../../../settings/settings');


////////////////////////////////////////////////////////////////////////////////


module.exports = function (N) {
  var schemas = N.config.setting_schemas || {};

  // Generate sub-event
  N.wire.after("init:models", { priority: 50 }, function emit_init_settings(N, callback) {
    N.wire.emit("init:__settings", N, callback);
  });

  N.wire.on("init:__settings", function init_settings(N, callback) {
    N.settings  = new Settings();

    _.each(N.runtime.apps, function (app) {
      var storesRoot = path.join(app.root, 'stores');

      fstools.walkSync(storesRoot, /\.js$/, function (file) {
        var apiPath, store;

        // skip "hidden" files (name/dir starts with underscore)
        if (file.match(/(^|\/|\\)_/)) { return; }

        apiPath = apify(file, storesRoot, /\.js$/);

        try {
          // Try to init store
          store = require(file)(N);

          if (!store) {
            callback(apiPath + " store constructor returns nothing (in: " + file + ")");
            return;
          }

          // register known keys and theirs default values
          _.each(schemas[apiPath], function (config, key) {
            store.addKnownKey(key, config['type'], config['default']);
          });

          // register store in settings
          N.settings.addStore(apiPath, store);
        } catch (err) {
          callback(err);
          return;
        }

      });
    });

    N.logger.info('Stores init done ');
    callback();
  });
};
