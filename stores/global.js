'use strict';


var _        = require('lodash');
var memoizee = require('memoizee');


var STORAGE_KEY = 'global_settings';


module.exports = function (N) {
  var KeyValueStorage = N.models.core.KeyValueStorage;


  function fetchGlobalSettings(callback) {
    KeyValueStorage
        .findOne({ key: STORAGE_KEY })
        .select('value')
        .setOptions({ lean: true })
        .exec(function (err, storage) {

      if (err) {
        callback(err);
        return;
      }

      var result = {};

      Object.keys(N.config.setting_schemas.global).forEach(function (name) {
        if (storage.value && Object.prototype.hasOwnProperty.call(storage.value, name)) {
          result[name] = { value: storage.value[name] };
        } else {
          result[name] = { value: GlobalStore.getDefaultValue(name) };
        }
      });

      callback(null, result);
    });
  }

  var fetchGlobalSettingsCached = memoizee(fetchGlobalSettings, {
    // Memoizee options. Revalidate cache after each 10 sec.
    async:     true
  , maxAge:    10000
  , primitive: true
  });


  var GlobalStore = N.settings.createStore({
    get: function (keys, params, options, callback) {
      var fetch = options.skipCache ? fetchGlobalSettings : fetchGlobalSettingsCached;

      fetch(function (err, settings) {
        if (err) {
          callback(err);
          return;
        }

        callback(null, _.pick(settings, keys));
      });
    }
  , set: function (values, params, callback) {
      KeyValueStorage.findOne({ key: STORAGE_KEY }).exec(function (err, storage) {
        if (err) {
          callback(err);
          return;
        }

        storage = storage || new KeyValueStorage({ key: STORAGE_KEY, value: {} });

        _.forEach(values, function (options, name) {
          if (null === options) {
            delete storage.value[name];
          } else {
            storage.value[name] = options.value;
          }
        });

        storage.markModified('value');
        storage.save(callback);
      });
    }
  });


  return GlobalStore;
};
