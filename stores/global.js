'use strict';


var _        = require('lodash');
var memoizee = require('memoizee');


module.exports = function (N) {
  var GlobalSettings = N.models.core.GlobalSettings;


  function fetchGlobalSettings(callback) {
    GlobalSettings
        .findOne()
        .setOptions({ lean: true })
        .exec(function (err, settings) {

      if (err) {
        callback(err);
        return;
      }

      var result = {};

      Object.keys(N.config.setting_schemas.global).forEach(function (name) {
        if (settings && Object.prototype.hasOwnProperty.call(settings.data, name)) {
          result[name] = { value: settings.data[name] };
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
      GlobalSettings.findOne().exec(function (err, settings) {
        if (err) {
          callback(err);
          return;
        }

        settings = settings || new GlobalSettings();

        _.forEach(values, function (options, name) {
          if (null === options) {
            delete settings.data[name];
          } else {
            settings.data[name] = options.value;
          }
        });

        settings.markModified('data');
        settings.save(callback);
      });
    }
  });


  return GlobalStore;
};
