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
      var settings = {};

      // Getter works with multiple groups.
      // Setter NEVER work with moe than one for integrity reasons.
      if (1 != env.groups.length) {
        callback(Error("Can't set on multiple groups"));
        return;
      }

      $$.each(data, function (key, val) {
        settings['settings.' + key] = val;
      });

      UserGroup.update({_id: env.groups[0]}, settings, callback);
    };


    this.__.getter = function (keys, env, callback) {
      var result = {};

      keys.forEach(function (key) {
        var chains;

        if (1 == env[STORE_KEY].length) {
          result[key] = env[STORE_KEY].settings[key];
          return;
        }

        // TODO: rework to support non-boolean vals as well

        // separate strict and non-strict values
        chains = {OR: [], AND: []};
        env[STORE_KEY].forEach(function (g) {
          var op = g.settings[key].strict ? 'AND' : 'OR';
          chains[op].push(g.settings[key].value);
        });

        result[key] = {strict: (0 < chains.AND.length)};

        if (0 == chains.OR.length) {
          result[key].value = (0 == $$.reject(chains.AND, function (v) { !!v; }).length);
        } else {
          result[key].value = (
            (0 < $$.select(chains.OR, function (v) { !!v; }).length)
            &&
            (0 == $$.reject(chains.AND, function (v) { !!v; }).length)
          );
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
