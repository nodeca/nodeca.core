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


var SETTING_SCHEMA = {
  extends:      false
, type:         null
, 'default':    null
, category_key: null
, group_key:    null
, priority:     10
, values:       null
, before_show:  null
, before_save:  null
, validators:   null
};


var SETTING_GROUP_SCHEMA = {
  parent:   null
, priority: 10
};


////////////////////////////////////////////////////////////////////////////////


module.exports = function (N) {
  // Generate sub-event
  N.wire.after("init:models", { priority: 50 }, function emit_init_settings(N, callback) {
    N.wire.emit("init:__settings", N, callback);
  });

  N.wire.on("init:__settings", function init_settings(N) {
    var schemas, groups;

    //
    // Normalize setting schemas.
    //

    if (N.config.setting_schemas) {
      schemas = N.config.setting_schemas;
    } else {
      schemas = N.config.setting_schemas = {};
    }

    _.forEach(schemas, function (store) {
      _.forEach(store, function (config, name) {
        schemas[name] = _.defaults(config || {}, SETTING_SCHEMA);
      });
    });

    //
    // Normalize setting groups.
    // (!) Groups are for global settings only, to organize interface.
    //

    if (N.config.setting_groups) {
      groups = N.config.setting_groups;
    } else {
      groups = N.config.setting_groups = {};
    }

    _.forEach(groups, function (config, name) {
      groups[name] = _.defaults(config || {}, SETTING_GROUP_SCHEMA);
    });

    // Check for nested groups - it's forbidden.
    _.forEach(N.config.setting_groups, function (config, name) {
      if (config.parent) {
        if (!groups.hasOwnProperty(config.parent)) {
          throw 'Setting group "' + name + '" is nested into a non-existent ' +
                'group "' + config.parent + '"';
        }

        if (groups[config.parent].parent) {
          throw 'Setting group "' + name + '" is nested into a non-root group ' +
                '"' + config.parent + '"';
        }
      }
    });

    //
    // Initialize Settings.
    //

    N.settings = new Settings();

    _.each(N.runtime.apps, function (app) {
      var storesRoot = path.join(app.root, 'stores');

      fstools.walkSync(storesRoot, /\.js$/, function (file) {
        var apiPath, store;

        // skip "hidden" files (name/dir starts with underscore)
        if (file.match(/(^|\/|\\)_/)) {
          return;
        }

        apiPath = apify(file, storesRoot, /\.js$/);

        // Try to init store
        store = require(file)(N);

        if (!store) {
          throw apiPath + " store constructor returns nothing (in: " + file + ")";
        }

        // register known keys and theirs default values
        _.each(schemas[apiPath], function (config, key) {
          store.addKnownKey(key, config['type'], config['default']);
        });

        // register store in settings
        N.settings.addStore(apiPath, store);
      });
    });

    N.logger.info('Stores init done ');
  });
};
