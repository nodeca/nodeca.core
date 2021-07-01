/**
 *  class Settings
 *
 *  Standalone settings manager used to manage stores.
 **/


'use strict';


// internal
const Store = require('./store');


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
    throw new Error('Store must be a subclass of Settings.Store');
  }

  if (this.__stores__[name]) {
    throw new Error(`Duplicate store name: ${name}`);
  }

  // set store name
  store.name = name;

  // register keys of the stores
  for (let key of store.keys) {
    if (!this.__keys__[key]) this.__keys__[key] = [];
    this.__keys__[key].push(store);
  }

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
Settings.prototype.get = async function get(keys, params = {}, options = {}) {
  let results     = {};
  let store_keys  = {}; // store -> keys to fetch
  let single      = !Array.isArray(keys);


  // prepare list of stores and (their known keys) to fetch
  for (let key of (single ? [ keys ] : keys)) {
    let stores = this.getStoresForKey(key);

    if (!stores.length) throw `Unknown settings key: ${key}`;

    for (let store of stores) {
      if (!store_keys[store.name]) store_keys[store.name] = [];
      store_keys[store.name].push(key);
    }
  }


  for (let data of await Promise.all(
    Object.keys(store_keys).map(name => this.getStore(name).get(store_keys[name], params, options))
  )) {
    for (let [ key, val ] of Object.entries(data)) {
      if (!results[key]) results[key] = [];
      results[key].push(val);
    }
  }


  let errors = [];

  // merge "raw" key values from multiple stores into final "single" result
  //
  //  { forum_can_view: [ { value: true }, { value: false } ], ...  }
  //      -> { forum_can_view: true, ... }
  for (let [ key, values ] of Object.entries(results)) {
    results[key] = this.mergeValues(values).value;

    if (results[key] === null) {
      errors.push(key);
    }
  }


  if (errors.length) {
    throw `Failed get values for settings: ${errors.join(', ')}`;
  }

  return single ? results[keys] : results;
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
Settings.prototype.getByCategory = function (categoryKey, params, options) {
  let keys = new Set();

  for (let store of Object.values(this.__stores__)) {
    for (let k of store.keysByCategory(categoryKey)) keys.add(k);
  }

  if (keys.size === 0) {
    return Promise.reject(`Settings: Failed get keys for category key: ${categoryKey}`);
  }

  return this.get(Array.from(keys), params, options);
};


/**
 *  Settings#mergeValues(settings) -> Object
 *  - settings (Array): List of setting objects with `value` and `force` keys.
 *
 *  Returns one of that settings which should be used.
 **/
Settings.prototype.mergeValues = function mergeValues(settings) {
  let result = null;

  for (let setting of settings) {
    if (!setting) continue;

    // Pick first setting.
    if (!result) {
      result = setting;
      continue;
    }

    // If forced value exists, it will have priority over regular one.
    if (!result.force && setting.force) {
      result = setting;
      continue;
    }

    // If multiple non-forced values exists, then 1 will take precedence over 0
    // We prefer to keep permissions in case of non-forced settings.
    //
    if (!result.force && !setting.force) {

      /* eslint-disable max-depth */
      // Number-specific rule. Prefer maximum number.
      if (typeof result.value === 'number' && typeof setting.value === 'number') {
        if (result.value < setting.value) {
          result = setting;
        }
        continue;
      }

      // String-specific rule. Prefer non-empty string.
      if (typeof result.value === 'string' && typeof setting.value === 'string') {
        if (result.value === '' && setting.value !== '') {
          result = setting;
        }
        continue;
      }

      // Boolean-specific rule. Prefer true.
      if (typeof result.value === 'boolean' && typeof setting.value === 'boolean') {
        if (!result.value && setting.value) {
          result = setting;
        }
        continue;
      }

      // Unsupported type or wrong types combination - error & terminate cycle.
      result = null;
      break;
    }

    // If multiple forced values exists, then 0 will take precedence over 1
    // We prefer to drop permissions in case of forced settings.
    //
    if (result.force && setting.force) {

      // Number-specific rule. Prefer minimum number.
      if (typeof result.value === 'number' && typeof setting.value === 'number') {
        if (result.value > setting.value) {
          result = setting;
        }
        continue;
      }

      // String-specific rule. Prefer empty string.
      if (typeof result.value === 'string' && typeof setting.value === 'string') {
        if (result.value !== '' && setting.value === '') {
          result = setting;
        }
        continue;
      }

      // Boolean-specific rule. Prefer false.
      if (typeof result.value === 'boolean' && typeof setting.value === 'boolean') {
        if (result.value && !setting.value) {
          result = setting;
        }
        continue;
      }

      // Unsupported type or wrong types combination - error & terminate cycle.
      result = null;
      break;
    }
  }

  return result;
};


// MODULE EXPORTS //////////////////////////////////////////////////////////////


module.exports = Settings;
