'use strict';


const _        = require('lodash');
const memoize  = require('promise-memoize');


module.exports = function (N) {
  const GlobalSettings = N.models.core.GlobalSettings;
  let GlobalStore;


  function fetchGlobalSettings() {
    return GlobalSettings.findOne().lean(true).exec().then(settings => {
      let result = {};

      // Fetch setting values written to the database, and use default values
      // for the others. If settings document does not exists - use default
      // setting values only.
      for (let name of GlobalStore.keys) {
        if (settings && settings.data.hasOwnProperty(name)) {
          result[name] = { value: settings.data[name] };
        } else {
          result[name] = { value: GlobalStore.getDefaultValue(name) };
        }
      }

      return result;
    });
  }

  let fetchGlobalSettingsCached = memoize(fetchGlobalSettings, { maxAge: 10000 });


  GlobalStore = N.settings.createStore({
    get(keys, params, options) {
      let fetch = options.skipCache ? fetchGlobalSettings : fetchGlobalSettingsCached;

      return fetch().then(settings => _.pick(settings, keys));
    },
    set(values) {
      return GlobalSettings.findOne().then(settings => {
        settings = settings || new GlobalSettings();

        for (let [ name, options ] of Object.entries(values)) {
          if (options === null) {
            delete settings.data[name];
          } else {
            settings.data[name] = options.value;
          }
        }

        settings.markModified('data');

        return settings.save();
      });
    }
  });


  return GlobalStore;
};
