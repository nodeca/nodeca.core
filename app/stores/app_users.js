'use strict';


var NLib = require('nlib');
var Underscore = NLib.Vendor.Underscore;


module.exports = function (app, callback) {
  var AppUsersStore = function AppUsersStore() {
    NLib.Settings.Store.call(this);


    var self = this,
        STORE_KEY = '__app_users_store__',
        AppSettings = app.getModel('AppSettings');


    this.__.preloader = function (env, callback) {
      if (!env.app || !env.app.name) {
        callback(new Error("Can't find app name"));
        return;
      }

      if (!env.user || !env.user._id) {
        callback(new Error("Can't user id"));
        return;
      }

      // environment was preloaded before
      if (env[STORE_KEY] && env[STORE_KEY][env.app.name]) {
        callback();
        return;
      }

      if (!env[STORE_KEY]) {
        env[STORE_KEY] = {};
      }

      AppSettings.findOne({app: env.app.name}, function (err, data) {
        self.keys.forEach(function (k) {
          data.settings[k] = data.settings[k] || [];
        });

        env[STORE_KEY][env.app.name] = {
          uid: env.user._id,
          settings: data.settings
        };

        callback(err);
      });
    };


    this.__.setter = function (data, env, callback) {
      var curr = env[STORE_KEY][env.app.name],
          settings = {};

      // prepare data to be set
      Underscore.each(data, function (val, key) {
        var tmp = Underscore.without(curr.settings[key], curr.uid);
        if (val) { tmp.push(curr.uid); }
        settings['settings.' + key] = tmp;
      });

      NLib.Settings.update({app: env.app.name}, settings, callback);
    };


    this.__.getter = function (keys, env, callback) {
      var result = {}, data = env[STORE_KEY][env.app.name];

      keys.forEach(function (key) {
        result[key] = {
          strict: false,
          value: Underscore.include(data.settings[key], data.uid)
        };
      });

      callback(null, result);
    };
  };


  NLib.Settings.Store.adopts(AppUsersStore);


  callback(null, new AppUsersStore());
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
