'use strict';



var _ = require('underscore');



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

  Object.defineProperty(this, '__set__', { value: options.set });
  Object.defineProperty(this, '__get__', { value: options.get });
  Object.defineProperty(this, '__keys__', { value: {} });
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
  var settings = {};

  _.each(values, function (obj, key) {
    var val;

    // unknown key for the store - skip
    if (!this.__keys__[key]) {
      return;
    }

    // value must be removed
    if (null === obj) {
      settings[key] = null;
      return;
    }

    //
    // type-cast
    //

    val = obj.value;

    if ('boolean' === this.__keys__[key].type) {
      // TRUE if not: false, 'false', '', '0', 0, null, undefined
      val = !('false' === String(val) || 0 === +val);
    }

    if ('number' === this.__keys__[key].type) {
      val = +val;
    }

    //
    // set "prepared" value
    //

    settings[key] = { value: val, force: !!obj.force };
  }, this);

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
  get: function () { return Object.keys(this.__keys__); }
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
