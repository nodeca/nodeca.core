// Load stores, their schemas & init N.settings
//


'use strict';


var _        = require('lodash');
var async    = require('async');
var path     = require('path');
var fstools  = require('fs-tools');
var apify    = require('../../../system/init/utils/apify');
var Settings = require('../../../settings/settings');


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


module.exports = function (N) {
  // Generate a sub-event in order to initialize settings manager.
  // The reason for that is to allow hooks in other apps like `nodeca.users` or
  // `nodeca.forum` to expose their extensions.
  // Currently only one extension is possible - special `values` fetcher.
  // It used for dropdown/combobox settings which need some dynamic data from
  // the database or whatever (e.g. 'usergroups' values fetcher).
  //
  N.wire.after('init:models', { priority: 50 }, function emit_init_settings(N, callback) {
    var extensions = { values: {} };

    N.wire.emit('init:settings', extensions, callback);
  });


  // Normalize setting schemas.
  //
  N.wire.before('init:settings', { priority: -1 }, function (extensions, callback) {
    var schemasCache = {}; // cache: setting name => array of schemas (from stores)

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
    async.forEach(_.keys(schemasCache), function (name, nextSetting) {
      var baseSchema = _.find(schemasCache[name], function (schema) {
        return !schema.extends;
      });

      async.forEach(schemasCache[name], function (schema, nextSchema) {
        if (schema.extends) {
          _.defaults(schema, baseSchema);
        }

        // No default value specified - try to detect or throw an error.
        if (!_.has(schema, 'default')) {
          if (!_.has(SETTING_TYPE_DEFAULTS, schema.type)) {
            nextSchema('There is no default value for setting of type ' +
                       '"' + schema.type + '".');
            return;
          }

          schema['default'] = SETTING_TYPE_DEFAULTS[schema.type];
        }

        // Use defaults for non-existent fields.
        _.defaults(schema, SETTING_SCHEMA_DEFAUTLS);

        // If `values` is a string - it's a special values fetcher function.
        if (_.isString(schema.values)) {
          if (!_.has(extensions.values, schema.values)) {
            nextSchema('There is no setting value options fetcher named ' +
                       '"' + schema.values + '". Check setting definitions.');
            return;
          }

          var fetcher = extensions.values[schema.values];

          // Expose the fetcher - setting editors will use it.
          schema.values = fetcher;

          // Resolve default values from the config using the fetcher.
          // It's needed since config values may be actually alias names of
          // values returned by the fetcher.
          // For example real value may be a generated ObjectId.
          fetcher(null, function (err, values) {
            if (err) {
              nextSchema(err);
              return;
            }

            schema['default'] = _.map(schema['default'], function (configValue) {
              var realValue = _.find(values, { name: configValue });

              return realValue ? realValue.value : configValue;
            });

            nextSchema();
          });
        } else {
          nextSchema();
        }
      }, nextSetting);
    }, callback);
  });


  // Normalize setting groups.
  // (!) Groups are for global settings only, to organize interface.
  //
  N.wire.before('init:settings', { priority: -1 }, function () {
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
  });


  // Initialize N.settings object.
  //
  N.wire.on('init:settings', function () {
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

    N.logger.info('Settings init done');
  });
};
