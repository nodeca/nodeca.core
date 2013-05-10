'use strict';



var _ = require('lodash');



////////////////////////////////////////////////////////////////////////////////


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
 *  - `set(settings, params, callback(err))` (Function):
 *    *REQUIRED* A setter backend
 **/
function Store(options) {
  options = options || {};

  if (!_.isFunction(options.set) || 3 !== options.set.length) {
    throw "Store set backend is required to be a function with 3 arguments";
  }

  if (!_.isFunction(options.get) || 4 !== options.get.length) {
    throw "Store get backend is required to be a function with 4 arguments";
  }

  this.__set__  = options.set;
  this.__get__  = options.get;
  this.__keys__ = {};
}


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

  this.__get__.call(this, single ? [keys] : keys, params, options, function (err, data) {
    callback(err, single ? data[keys] : data);
  });
};


/**
 *  Settings.Store#set(values, params, callback(err)) -> Void
 *  - values (Object): Key-Value hash of settings
 *  - params (Object): Params used to get value of a key
 *  - value (Mixed): New value for the `key`
 *  - callback (Function): Executed once, everything is done.
 *
 *  Sets new settings values.
 **/
Store.prototype.set = function set(values, params, callback) {
  var err, settings = {};

  _.forEach(values, function (setting, key) {
    if (!_.has(this.__keys__, key)) {
      return; // Skip unregistered setting.
    }

    if (!_.isObject(setting) && !_.isNull(setting)) {
      err = new Error('Setting must be an object or null.');
      return false;
    }

    if (null === setting) {
      settings[key] = null; // i.e. remove setting.
      return; // Continue.
    }

    switch (this.__keys__[key].type) {
    case 'boolean':
      if (!_.isBoolean(setting.value)) {
        err = new Error('Value of ' + key + ' setting must be a boolean.');
        return false;
      }
      break;

    case 'number':
      if (!_.isNumber(setting.value)) {
        err = new Error('Value of ' + key + ' setting must be a number.');
        return false;
      }
      break;

    // Except string type otherwise.
    default:
      if (!_.isString(setting.value)) {
        err = new Error('Value of ' + key + ' setting must be a string.');
        return false;
      }
      break;
    }

    settings[key] = { value: setting.value, force: Boolean(setting.force) };
  }, this);

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
 *  - type (String): Value type used for typecasting upon [[Store#set]]
 *  - value (Mixed): Default setting value
 *
 *  Adds `key` with `type` and its default `value` to be served by the store.
 **/
Store.prototype.addKnownKey = function addKnownKey(key, type, value) {
  this.__keys__[key] = { type: type, value: value };
};


/**
 *  Store#getDefaultValue(key) -> Mixed
 *  - key (String): Setting key
 *
 *  Returns default value for the setting.
 **/
Store.prototype.getDefaultValue = function getDefaultValue(key) {
  return (this.__keys__[key] || {}).value;
};


////////////////////////////////////////////////////////////////////////////////


module.exports = Store;
