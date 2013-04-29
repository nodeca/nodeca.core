'use strict';



var _     = require('lodash');
var async = require('async');


////////////////////////////////////////////////////////////////////////////////


module.exports = function (N) {
  var GlobalSettings = N.models.core.GlobalSettings;

  var GlobalStore = N.settings.createStore({
    get: function (keys, params, options, callback) {
      var results = {};

      async.forEach(keys, function (key, next) {
        GlobalSettings.findOne({ name: key }, 'value', function (err, doc) {
          if (err) {
            next(err);
            return;
          }

          var value = (doc || {}).value;

          if (undefined === value) {
            value = GlobalStore.getDefaultValue(key);
          }

          results[key] = { value: value };
          next();
        });
      }, function (err) {
        if (err) {
          callback(err);
          return;
        }

        callback(null, results);
      });
    }
  , set: function (values, params, callback) {
      async.forEach(_.keys(values), function (key, next) {
        GlobalSettings.findOneAndUpdate({ name:   key               },
                                        { value:  values[key].value },
                                        { upsert: true              },
                                        next);
      }, callback);
    }
  });

  return GlobalStore;
};
