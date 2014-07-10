'use strict';


var _ = require('lodash');


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
function Store(options) {
  options = options || {};

  if (!_.isFunction(options.set) || 3 !== options.set.length) {
    throw 'Store set backend is required to be a function with 3 arguments';
  }

  if (!_.isFunction(options.get) || 4 !== options.get.length) {
    throw 'Store get backend is required to be a function with 4 arguments';
  }

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
  if (!_.isObject(settings)) {
    return 'Input settings must be Object.';
  }

  var keys = _.keys(settings);
  var index, length, key, setting;

  for (index = 0, length = keys.length; index < length; index += 1) {
    key     = keys[index];
    setting = settings[key];

    if (!_.isObject(setting) && !_.isNull(setting)) {
      return 'Setting must be Object or Null.';
    }

    if (_.isNull(setting)) {
      continue; // Ok - nothing more to check here. Check next one.
    }

    if (!_.has(setting, 'value')) {
      return 'Setting must contain `value` property.';
    }

    if (_.has(setting, 'force') && !_.isBoolean(setting.force)) {
      return 'Setting\'s `force` property must be Boolean.';
    }

    if (!_.has(this.__keys__, key)) {
      return 'Unknown setting: ' + key;
    }

    switch (this.__keys__[key].type) {
    case 'boolean':
      if (!_.isBoolean(setting.value)) {
        return 'Value of ' + key + ' setting must be a boolean.';
      }
      break;

    case 'number':
      if (!_.isNumber(setting.value)) {
        return 'Value of ' + key + ' setting must be a number.';
      }
      break;

    case 'combobox':
      if (!_.isArray(setting.value)) {
        return 'Value of ' + key + ' setting must be an array.';
      }
      break;

    // Except string type otherwise.
    default:
      if (!_.isString(setting.value)) {
        return 'Value of ' + key + ' setting must be a string.';
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
 **/
Store.prototype.get = function get(keys, params, options, callback) {
  var single = !_.isArray(keys);

  if (!callback) {
    callback = options;
    options  = {};
  }

  this.__get__.call(this, single ? [ keys ] : keys, params, options, function (err, data) {
    callback(err, single ? data[keys] : data);
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
Store.prototype.set = function set(settings, params, callback) {
  var err = this.validate(settings);

  if (err) {
    callback(err);
    return;
  }

  this.__set__.call(this, settings, params, callback);
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
  get: function () {
    return Object.keys(this.__keys__);
  }
});


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
  return (this.__keys__[key] || {})['default'];
};


/**
 *  Store#getEmptyValue(key) -> Mixed
 *  - key (String): Setting key
 *
 *  Returns empty value for the setting.
 **/
Store.prototype.getEmptyValue = function getEmptyValue(key) {
  return (this.__keys__[key] || {}).empty_value;
};


module.exports = Store;
