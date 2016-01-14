// Load stores, their schemas & init N.settings
//


'use strict';


var _        = require('lodash');
var async    = require('async');
var path     = require('path');
var glob     = require('glob').sync;
var apify    = require('../../../../system/init/utils/apify');
var Settings = require('../../../../settings/settings');


var SETTING_SCHEMA_DEFAUTLS = {
  'extends':    false,
  type:         null,
  'default':    null,
  empty_value:  null,
  category_key: null,
  group_key:    null,
  priority:     10,
  values:       null,
  before_show:  null,
  before_save:  null,
  validators:   null
};


var SETTING_GROUP_DEFAUTLS = {
  parent:   null,
  priority: 10
};


/*eslint-disable no-reserved-keys*/

var SETTING_TYPE_DEFAULTS = {
  boolean:  false,
  number:     0,
  string:     '',
  text:       '',
  wysiwyg:    '',
  combobox:   []
};


var SETTING_TYPE_EMPTY_VALUES = {
  boolean:  false,
  number:     0,
  string:     '',
  text:       '',
  wysiwyg:    '',
  dropdown:   [],
  combobox:   []
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
    N.settings = new Settings();

    N.wire.emit('init:settings', {}, callback);
  });


  // Normalize setting schemas.
  // - Resolve `extents` flags.
  // - Add all missing fields.
  // - Try to detect `default` depending on `type` or throw an error.
  // - If `values` is an array, then normalize it's format.
  // - If `values` is a string, then replace it with a fetcher function.
  //
  // Example:
  //
  //   email_transport:
  //     group_key: email
  //     category_key: email_common
  //     type: dropdown
  //     values:
  //       - none
  //       - sendmail: TRANSPORT_SENDMAIL
  //     default: sendmail
  // =>
  //
  //   email_transport:
  //     extends: false
  //     priority: 10
  //     group_key: email
  //     category_key: email_common
  //     type: dropdown
  //     values:
  //       - name: none
  //         value: none
  //         title: admin.core.setting_values.email_transport.none
  //
  //       - name: sendmail
  //         value: TRANSPORT_SENDMAIL
  //         title: admin.core.setting_values.email_transport.sendmail
  //     default: sendmail
  //     empty_value: null
  //     before_show: null
  //     before_save: null
  //     validators: null
  //
  N.wire.on('init:settings', function normalize_setting_schemas() {
    var schemasCache = {}; // cache: setting name => array of schemas (from stores)

    if (!N.config.setting_schemas) {
      N.config.setting_schemas = {};
    }

    // Collect all available setting schemas form different stores.
    _.forEach(N.config.setting_schemas, function (store) {
      _.forEach(store, function (schema, name) {
        if (!schemasCache[name]) {
          schemasCache[name] = [];
        }

        schemasCache[name].push(schema);
      });
    });

    // Resolve `extends` flags and fill-in default schema values.
    _.forEach(schemasCache, function (schemaList, settingName) {
      var baseSchema = _.find(schemaList, function (schema) {
        return !schema.extends;
      });

      schemaList.forEach(function (schema) {
        if (schema.extends) {
          _.defaults(schema, baseSchema);
        }

        // No default value specified - try to detect or throw an error.
        if (!_.has(schema, 'default')) {
          if (!_.has(SETTING_TYPE_DEFAULTS, schema.type)) {
            throw 'There is no default value for setting of type ' +
                  '"' + schema.type + '".';
          }

          schema['default'] = SETTING_TYPE_DEFAULTS[schema.type];
        }

        // Set empty value for current schema.
        if (_.has(SETTING_TYPE_EMPTY_VALUES, schema.type)) {
          schema.empty_value = SETTING_TYPE_EMPTY_VALUES[schema.type];
        } else {
          schema.empty_value = null;
        }

        // Use defaults for non-existent fields.
        _.defaults(schema, SETTING_SCHEMA_DEFAUTLS);

        // All rest code is about normalization of `values` field.
        if (!schema.values) {
          return; // Done.
        }

        // When `values` is a string - assume it's name of a fetcher function
        // like 'usergroups'. Replace this string with the function.
        if (_.isString(schema.values)) {
          if (!N.settings.customizers[schema.values]) {
            throw 'There is no setting value options fetcher named ' +
                  '"' + schema.values + '". Check setting definitions.';
          }

          schema.values = N.settings.customizers[schema.values];
          return;
        }

        // Otherwise `values` should be a static array. Normalize it.
        if (Array.isArray(schema.values)) {
          schema.values = schema.values.map(function (value) {
            var key;

            if (_.isObject(value)) {
              // key:value pair.
              key = _.keys(value)[0];
              value = value[key];
            } else {
              // single value - assume it's both the key and the value.
              key = value;
            }

            return {
              name: key,
              value: value,
              title: 'admin.core.setting_values.' + settingName + '.' + key
            };
          });
          return;
        }

        throw 'Bad setting schema "' + settingName + '"; `values` field must ' +
              'be an array or a string';
      });
    });
  });


  // Try to resolve `default` fields for schemas where `values` is a function.
  //
  //   type: combobox
  //   values: usergroups # function
  //   default: [ 'administrators', 'members' ]
  //
  // =>
  //
  //   type: combobox
  //   values: usergroups # function
  //   default: [ '518a7f652065d47310000002', '518a7f652065d47310000003' ]
  //
  N.wire.on('init:settings', function resolve_schema_defaults(sandbox, callback) {
    var resolvers = [];

    // Select schemas with a function as `values` (i.e. dynamic schemas) and
    // some actual `default` value. Skip the others in order to not overflow
    // call stack since each "resolve" is an asynchronous operation.
    //
    _.forEach(N.config.setting_schemas, function (store) {
      _.forEach(store, function (schema) {
        if (!_.isFunction(schema.values) || _.isEmpty(schema['default'])) {
          // There is nothing to resolve.
          return;
        }

        function resolver(next) {
          schema.values(function (err, values) {
            if (err) {
              next(err);
              return;
            }

            // Finds 'real' value if a configured one (from `default` field) is
            // an alias name. Returns the configured value if none is found.
            function findValue(configured) {
              var fetched = _.find(values, { name: configured });

              return fetched ? fetched.value : configured;
            }

            if (_.isArray(schema['default'])) {
              schema['default'] = _.map(schema['default'], findValue);
            } else {
              schema['default'] = findValue(schema['default']);
            }

            next();
          });
        }

        resolvers.push(resolver);
      });
    });

    async.series(resolvers, callback);
  });


  // Normalize setting groups.
  // (!) Groups are for global settings only, to organize interface.
  //
  N.wire.on('init:settings', function normalize_setting_groups() {
    if (!N.config.setting_groups) {
      N.config.setting_groups = {};
    }

    _.forEach(N.config.setting_groups, function (group, name, collection) {
      collection[name] = _.defaults(group || {}, SETTING_GROUP_DEFAUTLS);
    });

    // Check for nested groups - it's forbidden.
    _.forEach(N.config.setting_groups, function (group, name, collection) {
      if (group.parent) {
        if (!collection[group.parent]) {
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
  N.wire.on('init:settings', function init_settings() {
    N.apps.forEach(app => {
      let storesRoot = path.join(app.root, 'stores');

      glob('**/*.js', {
        cwd: storesRoot
      })
      .filter(name => !/^[._]|\\[._]|\/[_.]/.test(name))
      .forEach(name => {
        let file = path.join(storesRoot, name);
        let apiPath = apify(file, storesRoot);

        let store = require(file)(N);

        if (!store) {
          throw `${apiPath} store constructor returns nothing (in: ${file})`;
        }

        // register known keys and theirs default values
        _.forEach(N.config.setting_schemas[apiPath], function (schema, key) {
          store.addKnownKey(key, schema);
        });

        // register store in settings
        N.settings.addStore(apiPath, store);
      });
    });

    N.logger.info('Settings init done');
  });
};
