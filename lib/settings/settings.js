/**
 *  class Settings
 *
 *  Standalone settings manager used to manage stores.
 **/


'use strict';


// 3rd-party
var _     = require('lodash');
var async = require('async');


// internal
var Store = require('./store');


////////////////////////////////////////////////////////////////////////////////


/**
 *  new Settings()
 *
 *  Creates new instance of settings manager.
 **/
function Settings() {
  // internal map of `name` -> `store`
  this.__stores__  = {};

  // internal map of `key` -> `stores`:
  // {
  //    'forum_can_view':   [ usergroup_store, forum_usergroup_store ],
  //    'is_moderator': [ forum_store ]
  // }
  this.__keys__    = {};

  // Shared space for custom functions. Currently used to get
  // dynamic lists for dropdowns & comboboxes in admin panes.
  // For example - list or usergroups
  this.customizers = {};
}


/**
 *  Settings#addStore(name, store) -> Void
 *  - name (String): Store name
 *  - store (Settings.Store): Instance of settings store
 **/
Settings.prototype.addStore = function addStore(name, store) {
  if (!(store instanceof Store)) {
    throw 'Store must be a subclass of Settings.Store';
  }

  if (this.__stores__[name]) {
    throw 'Duplicate store name: ' + name;
  }

  // set store name
  store.name = name;

  // register keys of the stores
  store.keys.forEach(function (key) {
    if (!this.__keys__[key]) {
      this.__keys__[key] = [];
    }

    this.__keys__[key].push(store);
  }, this);

  // register store
  this.__stores__[name] = store;
};


/**
 *  Settings#createStore(schema) -> Settings.Store
 *  - schema (String): Store schema
 **/
Settings.prototype.createStore = function createStore(schema) {
  return new Store(schema);
};


/**
 *  Settings#getStore(name) -> Settings.Store|Null
 *  - name (String): Store name
 **/
Settings.prototype.getStore = function getStore(name) {
  return this.__stores__[name] || null;
};


/**
 *  Settings#getStoresForKey(key) -> Array
 *  - key (String): Setting key
 *
 *  Returns list of stores that knows about `key`.
 **/
Settings.prototype.getStoresForKey = function getStoresForKey(key) {
  return !this.__keys__[key] ? [] : this.__keys__[key].slice();
};


/**
 *  Settings#get(keys, [params[, options]], callback(err, values)) -> Void
 *  - keys (String|Array): Setting key(s)
 *  - params (Object): Params used to get value of a key
 *  - options (Object): Extra options for fine tuning, see below.
 *  - callback (Function): Executed once, everything is done.
 *
 *  Returns "aggregated" value of a `key` from all stores
 *  associated with it. In comparison to [[Settings.Store#get]], each value here
 *  is a simple (scalar) value, e.g. `false`, and not an object with flags.
 *
 *  ##### Options
 *
 *  - *skipCache* (Boolean): Skip cache and get value from database. Default: false
 *  - *cache* (Object): Cache data, that can be used instead of hitting database.
 *    Ignored if `skipCache` is true.
 **/
Settings.prototype.get = function get(keys, params, options, callback) {
  var self        = this;
  var results     = {};
  var store_keys  = {}; // store -> keys to fetch
  var single      = !_.isArray(keys);
  var err;

  // Case: get(['key', 'key'], { param: foo }, function () { ... })
  if (!callback) {
    callback = options;
    options  = {};
  }

  // Case: get(['key', 'key'], function () { ... })
  if (!callback) {
    callback = params;
    params   = {};
  }

  // prepare list of stores and (their known keys) to fetch
  (single ? [ keys ] : keys).forEach(function (key) {
    var stores = self.getStoresForKey(key);

    if (!stores.length) {
      err = 'Unknown settings key: ' + key;
    }

    stores.forEach(function (store) {
      if (!store_keys[store.name]) {
        store_keys[store.name] = [];
      }

      store_keys[store.name].push(key);
    });
  });

  if (err) {
    callback(err);
    return;
  }

  async.each(Object.keys(store_keys), function (name, next) {
    self.getStore(name).get(store_keys[name], params, options, function (err, data) {
      if (err) {
        next(err);
        return;
      }

      _.forEach(data, function (val, key) {
        if (!results[key]) {
          results[key] = [];
        }

        results[key].push(val);
      });

      next();
    });
  }, function (err) {
    var errors = [];

    if (err) {
      callback(err);
      return;
    }

    // merge "raw" key values from multiple stores into final "single" result
    //
    //  { forum_can_view: [ { value: true }, { value: false } ], ...  }
    //      -> { forum_can_view: true, ... }
    _.forEach(results, function (values, key) {
      results[key] = self.mergeValues(values).value;

      if (null === results[key]) {
        errors.push(key);
      }
    });


    if (errors.length) {
      callback('Failed get values for settings: ' + errors.join(', '));
      return;
    }

    callback(null, single ? results[keys] : results);
  });
};


/**
 *  Settings#getByCategory(categoryKey, [params[, options]], callback(err, values)) -> Void
 *  - categoryKey (String): Settings category key
 *  - params (Object): Params used to get value of a key
 *  - options (Object): Extra options for fine tuning, see below.
 *  - callback (Function): Executed once, everything is done.
 *
 *  Returns "aggregated" value of a keys related to `categoryKey` from all stores
 *  associated with it. In comparison to [[Settings.Store#get]], each value here
 *  is a simple (scalar) value, e.g. `false`, and not an object with flags.
 *
 *  ##### Options
 *
 *  - *skipCache* (Boolean): Skip cache and get value from database. Default: false
 *  - *cache* (Object): Cache data, that can be used instead of hitting database.
 *    Ignored if `skipCache` is true.
 **/
Settings.prototype.getByCategory = function (categoryKey, params, options, callback) {
  var keys = _.reduce(this.__stores__, function (result, store) {
    return result.concat(store.keysByCategory(categoryKey));
  }, []);

  keys = _.uniq(keys);

  if (keys.length === 0) {
    callback = callback || options || params;
    callback('Settings: Failed get keys for category key: ' + categoryKey);
    return;
  }

  this.get(keys, params, options, callback);
};


/**
 *  Settings#mergeValues(settings) -> Object
 *  - settings (Array): List of setting objects with `value` and `force` keys.
 *
 *  Returns one of that settings which should be used.
 **/
Settings.prototype.mergeValues = function mergeValues(settings) {
  var result = null;

  _.forEach(settings, function (setting) {

    /*eslint-disable consistent-return*/

    if (!setting) {
      return;
    }

    // Pick first setting.
    if (!result) {
      result = setting;
      return;
    }

    // If forced value exists, it will have priority over regular one.
    if (!result.force && setting.force) {
      result = setting;
      return;
    }

    // If multiple non-forced values exists, then 1 will take precedence over 0
    // We prefer to keep permissions in case of non-forced settings.
    //
    if (!result.force && !setting.force) {

      // Number-specific rule. Prefer maximum number.
      if (_.isNumber(result.value) && _.isNumber(setting.value)) {
        if (result.value < setting.value) {
          result = setting;
        }
        return;
      }

      // String-specific rule. Prefer non-empty string.
      if (_.isString(result.value) && _.isString(setting.value)) {
        if (_.isEmpty(result.value) && !_.isEmpty(setting.value)) {
          result = setting;
        }
        return;
      }

      // Boolean-specific rule. Prefer true.
      if (_.isBoolean(result.value) && _.isBoolean(setting.value)) {
        if (!result.value && setting.value) {
          result = setting;
        }
        return;
      }

      // Unsupported type or wrong types combination - error & terminate cycle.
      result = null;
      return false;
    }

    // If multiple forced values exists, then 0 will take precedence over 1
    // We prefer to drop permissions in case of forced settings.
    //
    if (result.force && setting.force) {

      // Number-specific rule. Prefer minimum number.
      if (_.isNumber(result.value) && _.isNumber(setting.value)) {
        if (result.value > setting.value) {
          result = setting;
        }
        return;
      }

      // String-specific rule. Prefer empty string.
      if (_.isString(result.value) && _.isString(setting.value)) {
        if (!_.isEmpty(result.value) && _.isEmpty(setting.value)) {
          result = setting;
        }
        return;
      }

      // Boolean-specific rule. Prefer false.
      if (_.isBoolean(result.value) && _.isBoolean(setting.value)) {
        if (result.value && !setting.value) {
          result = setting;
        }
        return;
      }

      // Unsupported type or wrong types combination - error & terminate cycle.
      result = null;
      return false;
    }
  });

  return result;
};


// MODULE EXPORTS //////////////////////////////////////////////////////////////


module.exports = Settings;
