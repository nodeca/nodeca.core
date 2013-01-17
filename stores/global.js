'use strict';


/*global underscore*/


// 3rd-party
var _     = underscore;
var async = require('async');
var Store = require('nlib/lib/nlib/settings/store');


////////////////////////////////////////////////////////////////////////////////


module.exports = function (N, apiPath) {
  var Model = N.models.stores.GlobalSettings;

  var GlobalStore = new Store({
    get: function (keys, params, options, callback) {
      var results = {};

      async.forEach(keys, function (key, next) {
        Model.findOne({ _id: key }, 'value', function (err, doc) {
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
    },
    set: function (values, params, callback) {
      async.forEach(_.keys(values), function (key, nextKey) {
        Model.set(key, values[key], nextKey);
      }, callback);
    }
  });


  GlobalStore.getCategories = function () {
    var categories = [];

    GlobalStore.keys.forEach(function (key) {
      var name = GlobalStore.getSchema(key).category;
      if (-1 === categories.indexOf(name)) {
        categories.push(name);
      }
    });

    return categories;
  };


  GlobalStore.fetchSettingsByCategory = function (category, callback) {
    var keys = [];

    GlobalStore.keys.forEach(function (key) {
      if (category === GlobalStore.getSchema(key).category) {
        keys.push(key);
      }
    });

    GlobalStore.get(keys, {}, {}, callback);
  };


  return GlobalStore;
};
