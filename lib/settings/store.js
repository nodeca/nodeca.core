'use strict';


const _ = require('lodash');


/**
 *  new Store(options)
 *  - options (Object): Store configuration options. See below.
 *
 *  Creates new store instance.
 *
 *
 *  ##### Options
 *
 *  - `get(keys, params, options, callback(err, results))` (Function):
 *    *REQUIRED* A getter backend
 *
 *  - `set(settings, params, callback(err))` (Function):
 *    *REQUIRED* A setter backend
 **/
function Store(options = {}) {
  this.__set__  = options.set;
  this.__get__  = options.get;
  this.__keys__ = {};
}


/**
 *  Settings.Store#validate(settings) -> Null|String
 *  - settings (Object): Key-Value hash of settings
 *
 *  Returns null if `settings` are good to save.
 *  Otherwise returns string with error description.
 **/
Store.prototype.validate = function validate(settings) {
  if (typeof settings !== 'object' || settings === null) {
    return 'Input settings must be Object.';
  }

  for (let [ key, setting ] of Object.entries(settings)) {
    if (typeof setting !== 'object' /* object or null */) {
      return 'Setting must be Object or Null.';
    }

    if (setting === null) {
      continue; // Ok - nothing more to check here. Check next one.
    }

    if (!_.has(setting, 'value')) {
      return 'Setting must contain `value` property.';
    }

    if (_.has(setting, 'force') && typeof setting.force !== 'boolean') {
      return "Setting's `force` property must be Boolean.";
    }

    if (!_.has(this.__keys__, key)) {
      return `Unknown setting: ${key}`;
    }

    switch (this.__keys__[key].type) {
      case 'boolean':
        if (typeof setting.value !== 'boolean') {
          return `Value of ${key} setting must be a boolean.`;
        }
        break;

      case 'number':
        if (typeof setting.value !== 'number') {
          return `Value of ${key} setting must be a number.`;
        }
        break;

      case 'combobox':
        if (!Array.isArray(setting.value)) {
          return `Value of ${key} setting must be an array.`;
        }
        break;

      // Except string type otherwise.
      default:
        if (typeof setting.value !== 'string') {
          return `Value of ${key} setting must be a string.`;
        }
        break;
    }
  }

  return null;
};


/**
 *  Settings.Store#get(keys, params[, options], callback(err, values)) -> Void
 *  - keys (String|Array): Setting key(s)
 *  - params (Object): Params used to get value of a key
 *  - options (Object): Extra options for fine tuning, see below.
 *  - callback (Function): Executed once, everything is done.
 *
 *  Each value is an instance of [[Value]].
 *
 *  ##### Options
 *
 *  - *skipCache* (Boolean): Skip cache and get value from database. Default: false
 *  - *cache* (Object): Cache data, that can be used instead of hitting database.
 *    Ignored if `skipCache` is true.
 *  - *alias* (Boolean): Rename keys by `as` schema param. Default: false
 **/
Store.prototype.get = function get(keys, params, options = {}) {
  let single = !Array.isArray(keys);

  return this.__get__.call(this, single ? [ keys ] : keys, params, options).then(data => {
    if (single) {
      return data[keys];
    }

    if (options.alias) {
      // Rename keys to aliases if available
      let result = {};
      for (let [ key, value ] of Object.entries(data)) {
        result[this.__keys__[key].as || key] = value;
      }
      return result;
    }

    return data;
  });
};


/**
 *  Settings.Store#set(settings, params, callback(err)) -> Void
 *  - settings (Object): Key-Value hash of settings
 *  - params (Object): Params used to get value of a key
 *  - value (Mixed): New value for the `key`
 *  - callback (Function): Executed once, everything is done.
 *
 *  Sets new settings values.
 **/
Store.prototype.set = function set(settings, params) {
  let err = this.validate(settings);

  if (err) return Promise.reject(err);

  return this.__set__.call(this, settings, params);
};


/**
 *  Settings.Store#keys -> Array
 *
 *  List of registered setting keys.
 *
 *
 *  ##### See Also
 *
 *  - [[Settings.Store#addKnownKey]]
 *  - [[Settings.Store#getDefaultValue]]
 **/
Object.defineProperty(Store.prototype, 'keys', {
  get() {
    return Object.keys(this.__keys__);
  }
});


/**
 *  Store#keysByCategory(categoryKey) -> Array
 *  - categoryKey (String): Setting `category_key`
 *
 *  List of setting keys related to `categoryKey`.
 **/
Store.prototype.keysByCategory = function keysByCategory(categoryKey) {
  let result = [];

  for (let [ key, schema ] of Object.entries(this.__keys__)) {
    if (schema.category_key === categoryKey) {
      result.push(key);
    }
  }

  return result;
};


/**
 *  Store#addKnownKey(key, type, value) -> Void
 *  - key (String): Setting key
 *  - schema (Object): Setting schema from N.config.setting_schemas
 *
 *  Adds `key` with `schema` to be served by the store.
 **/
Store.prototype.addKnownKey = function addKnownKey(key, schema) {
  this.__keys__[key] = schema;
};


/**
 *  Store#getDefaultValue(key) -> Mixed
 *  - key (String): Setting key
 *
 *  Returns default value for the setting.
 **/
Store.prototype.getDefaultValue = function getDefaultValue(key) {
  return this.__keys__[key]?.default;
};


/**
 *  Store#getEmptyValue(key) -> Mixed
 *  - key (String): Setting key
 *
 *  Returns empty value for the setting.
 **/
Store.prototype.getEmptyValue = function getEmptyValue(key) {
  return this.__keys__[key]?.empty_value;
};


module.exports = Store;
