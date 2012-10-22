'use strict';


/*global nodeca, _*/


// 3rd-party
var Store = require('nlib').Settings.Store;
var async = require('nlib').Vendor.Async;


// internal
var Model = nodeca.models.stores.GlobalSettings;


////////////////////////////////////////////////////////////////////////////////


var GlobalStore = new Store({
  get: function (key, params, options, callback) {
    Model.findOne({ _id: key }, 'value', function (err, doc) {
      var value = (doc || {}).value;

      if (undefined === value) {
        value = GlobalStore.getDefaultValue(key);
      }

      callback(err, { value: value });
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


////////////////////////////////////////////////////////////////////////////////


module.exports = GlobalStore;
