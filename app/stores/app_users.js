var nodeca = require('nodeca-lib'),
    Store = nodeca.Settings.Store,
    $$ = nodeca.Utilities;


module.exports = (function (app, callback) {
  var AppUsersStore = function AppUsersStore() {
    Store.call(this);


    var self = this,
        STORE_KEY = '__app_users_store__',
        AppSettings = app.model('AppSettings');


    this.__.preloader = function (env, callback) {
      if (!env.app) {
        callback(Error("Can't find app"));
        return;
      }

      if (!env.user || !env.user._id) {
        callback(Error("Can't user id"));
        return;
      }

      // environment was preloaded before
      if (env[STORE_KEY] && env[STORE_KEY][env.app]) {
        callback();
        return;
      }

      if (!env[STORE_KEY]) {
        env[STORE_KEY] = {};
      }

      AppSettings.findOne({app: env.app}, function (err, data) {
        self.keys.forEach(function (k) {
          data.settings[k] = data.settings[k] || [];
        });

        env[STORE_KEY][env.app] = {
          uid: env.user._id,
          settings: data.settings
        };

        callback(err);
      });
    };


    this.__.setter = function (data, env, callback) {
      var curr = env[STORE_KEY][env.app],
          settings = {};

      // prepare data to be set
      $$.each(data, function (key, val) {
        var tmp = $$.reject(curr.settings[key], curr.uid);
        if (val) { tmp.push(curr.uid); }
        settings['settings.' + key] = tmp;
      });

      Settings.update({app: env.app}, settings, callback);
    };


    this.__.getter = function (keys, env, callback) {
      var result = {}, data = env[STORE_KEY][env.app];

      keys.forEach(function (key) {
        result[key] = {
          strict: false,
          value: $$.includes(data.settings[key], data.uid)
        };
      });

      callback(null, result);
    };
  };


  Store.adopts(AppUsersStore);


  callback(null, new AppUsersStore());
});


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
