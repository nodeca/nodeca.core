// Load stores, their schemas & init N.settings
//


'use strict';


const path     = require('path');
const glob     = require('glob').sync;
const apify    = require('../../../../system/init/utils/apify');
const Settings = require('../../../../settings/settings');


const SETTING_SCHEMA_DEFAULTS = {
  extends:      false,
  type:         null,
  default:      null,
  empty_value:  null,
  category_key: null,
  group_key:    null,
  priority:     10,
  values:       null,
  before_show:  null,
  before_save:  null,
  validators:   null
};


const SETTING_GROUP_DEFAULTS = {
  parent:   null,
  priority: 10
};


const SETTING_TYPE_DEFAULTS = {
  boolean:    false,
  number:     0,
  string:     '',
  multiline:  '',
  wysiwyg:    '',
  combobox:   []
};


const SETTING_TYPE_EMPTY_VALUES = {
  boolean:    false,
  number:     0,
  string:     '',
  multiline:  '',
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
  N.wire.after('init:models', { priority: 50 }, async function emit_init_settings() {
    N.settings = new Settings();

    await N.wire.emit('init:settings', {});
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
    let schemasCache = {}; // cache: setting name => array of schemas (from stores)

    if (!N.config.setting_schemas) {
      N.config.setting_schemas = {};
    }

    // Collect all available setting schemas form different stores.
    for (let store of Object.values(N.config.setting_schemas)) {
      for (let [ name, schema ] of Object.entries(store)) {
        if (!schemasCache[name]) {
          schemasCache[name] = [];
        }

        schemasCache[name].push(schema);
      }
    }

    // Resolve `extends` flags and fill-in default schema values.
    for (let [ settingName, schemaList ] of Object.entries(schemasCache)) {
      let baseSchema = schemaList.find(schema => !schema.extends);

      for (let schema of schemaList) {
        /* eslint-disable max-depth */
        if (schema.extends) {
          for (let [ key, value ] of Object.entries(baseSchema)) {
            schema[key] = schema[key] ?? value;
          }
        }

        // No default value specified - try to detect or throw an error.
        if (!schema.hasOwnProperty('default')) {
          if (!SETTING_TYPE_DEFAULTS.hasOwnProperty(schema.type)) {
            throw `There is no default value for setting of type "${schema.type}".`;
          }

          schema.default = SETTING_TYPE_DEFAULTS[schema.type];
        }

        // Set empty value for current schema.
        if (SETTING_TYPE_EMPTY_VALUES.hasOwnProperty(schema.type)) {
          schema.empty_value = SETTING_TYPE_EMPTY_VALUES[schema.type];
        } else {
          schema.empty_value = null;
        }

        // Use defaults for non-existent fields.
        for (let [ key, value ] of Object.entries(SETTING_SCHEMA_DEFAULTS)) {
          schema[key] = schema[key] ?? value;
        }

        // All rest code is about normalization of `values` field.
        if (!schema.values) continue; // Done.

        // When `values` is a string - assume it's name of a fetcher function
        // like 'usergroups'. Replace this string with the function.
        if (typeof schema.values === 'string') {
          if (!N.settings.customizers[schema.values]) {
            throw `There is no setting value options fetcher named "${schema.values}". Check setting definitions.`;
          }

          schema.values = N.settings.customizers[schema.values];
          continue;
        }

        // Otherwise `values` should be a static array. Normalize it.
        if (Array.isArray(schema.values)) {
          schema.values = schema.values.map(value => {
            let key;

            if (typeof value === 'object' && value !== null) {
              // key:value pair.
              key = Object.keys(value)[0];
              value = value[key];
            } else {
              // single value - assume it's both the key and the value.
              key = value;
            }

            return {
              name: key,
              value,
              title: `admin.core.setting_values.${settingName}.${key}`
            };
          });
          continue;
        }

        throw `Bad setting schema "${settingName}"; "values" field must be an array or a string`;
      }
    }
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
  N.wire.on('init:settings', async function resolve_schema_defaults() {
    let resolvers = [];

    // Select schemas with a function as `values` (i.e. dynamic schemas) and
    // some actual `default` value. Skip the others in order to not overflow
    // call stack since each "resolve" is an asynchronous operation.
    //
    for (let store of Object.values(N.config.setting_schemas)) {
      for (let schema of Object.values(store)) {
        if (typeof schema.values !== 'function' || !Object.keys(schema.default || {}).length) {
          // There is nothing to resolve.
          continue;
        }

        resolvers.push(schema.values().then(values => {
          // Finds 'real' value if a configured one (from `default` field) is
          // an alias name. Returns the configured value if none is found.
          function findValue(configured) {
            let fetched = values.find(v => v.name === configured);

            return fetched ? fetched.value : configured;
          }

          if (Array.isArray(schema.default)) {
            schema.default = schema.default.map(findValue);
          } else {
            schema.default = findValue(schema.default);
          }
        }));
      }
    }

    await Promise.all(resolvers);
  });


  // Normalize setting groups.
  // (!) Groups are for global settings only, to organize interface.
  //
  N.wire.on('init:settings', function normalize_setting_groups() {
    if (!N.config.setting_groups) {
      N.config.setting_groups = {};
    }

    for (let [ name, group ] of Object.entries(N.config.setting_groups)) {
      if (!group) {
        N.config.setting_groups[name] = group = {};
      }

      for (let [ key, value ] of Object.entries(SETTING_GROUP_DEFAULTS)) {
        group[key] = group[key] ?? value;
      }
    }

    // Check for nested groups - it's forbidden.
    for (let [ name, group ] of Object.entries(N.config.setting_groups)) {
      if (group.parent) {
        if (!N.config.setting_groups[group.parent]) {
          throw `Setting group "${name}" is nested into a non-existent group "${group.parent}"`;
        }

        if (N.config.setting_groups[group.parent].parent) {
          throw `Setting group "${name}" is nested into a non-root group "${group.parent}"`;
        }
      }
    }
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
        for (let [ key, schema ] of Object.entries(N.config.setting_schemas[apiPath])) {
          store.addKnownKey(key, schema);
        }

        // register store in settings
        N.settings.addStore(apiPath, store);
      });
    });

    N.logger.info('Settings init done');
  });
};
