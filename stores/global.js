'use strict';


const _        = require('lodash');
const memoizee = require('memoizee');
const thenify  = require('thenify');


module.exports = function (N) {
  const GlobalSettings = N.models.core.GlobalSettings;
  let GlobalStore;


  function fetchGlobalSettings(callback) {
    GlobalSettings.findOne().lean(true).exec(function (err, settings) {
      if (err) {
        callback(err);
        return;
      }

      let result = {};

      // Fetch setting values written to the database, and use default values
      // for the others. If settings document does not exists - use default
      // setting values only.
      _.forEach(GlobalStore.keys, function (name) {
        if (settings && _.has(settings.data, name)) {
          result[name] = { value: settings.data[name] };
        } else {
          result[name] = { value: GlobalStore.getDefaultValue(name) };
        }
      });

      callback(null, result);
    });
  }

  let fetchGlobalSettingsCached = thenify(memoizee(fetchGlobalSettings, {
    // Memoizee options. Revalidate cache after each 10 sec.
    async:     true,
    maxAge:    10000,
    primitive: true
  }));

  let fetchGlobalSettingsAsync = thenify(fetchGlobalSettings);


  GlobalStore = N.settings.createStore({
    get(keys, params, options) {
      let fetch = options.skipCache ? fetchGlobalSettingsAsync : fetchGlobalSettingsCached;

      return fetch().then(settings => _.pick(settings, keys));
    },
    set(values) {
      return GlobalSettings.findOne().then(settings => {
        settings = settings || new GlobalSettings();

        _.forEach(values, function (options, name) {
          if (options === null) {
            delete settings.data[name];
          } else {
            settings.data[name] = options.value;
          }
        });

        settings.markModified('data');

        return settings.save();
      });
    }
  });


  return GlobalStore;
};
