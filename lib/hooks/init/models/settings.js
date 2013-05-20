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


var SETTING_SCHEMA_DEFAUTLS = {
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


var SETTING_GROUP_DEFAUTLS = {
  parent:   null
, priority: 10
};


var SETTING_TYPE_DEFAULTS = {
  boolean:  false
, number:   0
, string:   ''
, text:     ''
, wysiwyg:  ''
, combobox: []
};


////////////////////////////////////////////////////////////////////////////////


module.exports = function (N) {
  // Generate sub-event
  N.wire.after("init:models", { priority: 50 }, function emit_init_settings(N, callback) {
    N.wire.emit("init:__settings", N, callback);
  });

  N.wire.on("init:__settings", function init_settings(N) {
    var schemasCache = {}; // cache: setting name => array of schemas (from stores)

    //
    // Normalize setting schemas.
    //

    if (!N.config.setting_schemas) {
      N.config.setting_schemas = {};
    }

    // Collect all available setting schemas form different stores.
    _.forEach(N.config.setting_schemas, function (store) {
      _.forEach(store, function (schema, name) {
        if (!schemasCache.hasOwnProperty(name)) {
          schemasCache[name] = [];
        }

        schemasCache[name].push(schema);
      });
    });

    // Resolve `extends` flags and fill-in default schema values.
    _.forEach(schemasCache, function (schemaList) {
      var baseSchema = _.find(schemaList, function (schema) {
        return !schema.extends;
      });

      _.forEach(schemaList, function (schema) {
        if (schema.extends) {
          _.defaults(schema, baseSchema);
        }

        // No default value specified - try to detect or throw an error.
        if (!_.has(schema, 'default')) {
          if (_.has(SETTING_TYPE_DEFAULTS, schema.type)) {
            schema['default'] = SETTING_TYPE_DEFAULTS[schema.type];
          } else {
            throw 'There is no default value for setting of type ' +
                  '"' + schema.type + '".';
          }
        }

        _.defaults(schema, SETTING_SCHEMA_DEFAUTLS);
      });
    });

    //
    // Normalize setting groups.
    // (!) Groups are for global settings only, to organize interface.
    //

    if (!N.config.setting_groups) {
      N.config.setting_groups = {};
    }

    _.forEach(N.config.setting_groups, function (group, name, collection) {
      collection[name] = _.defaults(group || {}, SETTING_GROUP_DEFAUTLS);
    });

    // Check for nested groups - it's forbidden.
    _.forEach(N.config.setting_groups, function (group, name, collection) {
      if (group.parent) {
        if (!collection.hasOwnProperty(group.parent)) {
          throw 'Setting group "' + name + '" is nested into a non-existent ' +
                'group "' + group.parent + '"';
        }

        if (collection[group.parent].parent) {
          throw 'Setting group "' + name + '" is nested into a non-root group ' +
                '"' + group.parent + '"';
        }
      }
    });

    //
    // Initialize Settings.
    //

    N.settings = new Settings();

    _.forEach(N.runtime.apps, function (app) {
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
        _.forEach(N.config.setting_schemas[apiPath], function (config, key) {
          store.addKnownKey(key, config['type'], config['default']);
        });

        // register store in settings
        N.settings.addStore(apiPath, store);
      });
    });

    N.logger.info('Stores init done ');
  });
};
