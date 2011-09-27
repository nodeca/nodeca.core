var nodeca = require('nodeca-lib'),
    Store = nodeca.Settings.Store,
    $$ = nodeca.Utilities;


var Promise = require('simple-promise');


module.exports = (function (app, callback) {
  var UserGroupStore = function UserGroupStore() {
    Store.call(this);


    var STORE_KEY = '__usergroup_store__',
        UserGroup = app.model('UserGroup');


    this.__.preloader = function (env, callback) {
      // environment was preloaded before
      if (env[STORE_KEY]) {
        callback();
        return;
      }

      // env.grous was neither specified directly nor found in user
      if (!Array.isArray(env.groups) || 0 == env.groups.length) {
        callback(Error("Can't find list of groups"));
        return;
      }

      UserGroup.find({_id: {$in: env.groups}}, function (err, groups) {
        env[STORE_KEY] = groups;
        callback(err);
      });
    };


    this.__.setter = function (data, env, callback) {
      var joint = new Promise.Joint(),
          settings = {};

      // prepare data to be set
      $$.each(data, function (key, val) { settings['settings.' + key] = val; });

      // call update for each group
      env[STORE_KEY].forEach(function (g) {
        UserGroup.update({ _id: g._id }, settings, joint.promise().resolve);
      });

      // wait for all changes to be complete
      joint.wait().done(function (err) {
        var i;

        // loop through promise results
        for (i = 1; i < arguments.length; i++) {
          // first argument (idx = 0) means error
          if (arguments[i][0]) { // err
            callback(arguments[i][0]);
            return;
          }
        }

        callback();
      });
    };


    this.__.getter = function (keys, env, callback) {
      var result = {};

      keys.forEach(function (key) {
        // TODO: rework to support non-boolean vals as well
        result[key] = {value: false, strict: false};

        result[key].value = 0 < $$.select(env[STORE_KEY], function (grp) {
          return !grp.settings[key].strict && grp.settings[key].value;
        }).length;

        if (result[key].value) {
          $$.select(env[STORE_KEY], function (grp) {
            return !grp.settings[key].strict && grp.settings[key].value;
          }).forEach(function (grp) {
            result[key].value = result[key].value && grp.settings[key].value;
            result[key].strict = true;
          });
        }
      });

      callback(null, result);
    };
  };


  Store.adopts(UserGroupStore);


  callback(null, new UserGroupStore());
});


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
