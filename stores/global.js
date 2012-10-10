'use strict';

/*global nodeca, _*/

var NLib = require('nlib');

var Async = NLib.Vendor.Async;

var store = {};

var Model = nodeca.models.stores.GlobalSettings;

module.exports.init = function (settings, callback) {
  store = settings;
  Model.find({}, function (err, docs) {
    if (err) {
      callback(err);
      return;
    }
    docs.forEach(function (doc) {
      store[doc._id.toString()]['value'] = doc.value;
    });
    callback();
  });
};

module.exports.get = function (key) {
  return store[key]['value'] === undefined ? store[key]['default'] : store[key]['value'];
};

module.exports.massSet = function (settings, callback) {
  Async.forEachSeries(settings, function (setting, next_setting) {
    if (setting.value !== store[setting.key]) {
      Model.set(setting.key, setting.value, next_setting);
    }
    else {
      next_setting();
    }
  }, callback);
};

module.exports.getCategories = function () {
  var categories = [];

  _.values(store).forEach(function (props) {
    if (categories.indexOf(props.category) === -1) {
      categories.push(props.category);
    }
  });
  return categories;
};

module.exports.fetchSettingsByCategory = function (category) {
  var result = {};
  _.keys(store).forEach(function (key) {
    if (store[key]['category'] === category) {
      result[key] = store[key];
    }
  });
  return result;
};
