'use strict';


var NLib = require('nlib'),
    Store = NLib.Settings.Store,
    Underscore = NLib.Underscore;


module.exports = function (app, callback) {
  var UserGroupStore = function UserGroupStore() {
    Store.call(this);


    var self = this,
        STORE_KEY = '__usergroup_store__',
        UserGroup = app.getModel('UserGroup');


    this.__.preloader = function (env, callback) {
      // environment was preloaded before
      if (env[STORE_KEY]) {
        callback();
        return;
      }

      // env.groups was neither specified directly nor found in user
      if (!Array.isArray(env.groups) || 0 === env.groups.length) {
        callback(new Error("Can't find list of groups"));
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
      if (1 !== env.groups.length) {
        callback(new Error("Can't set on multiple groups"));
        return;
      }

      Underscore.each(data, function (val, key) {
        // remove strict flag as we keep it in usergroup
        if ('object' === typeof val) {
          delete val.strict;
        }
        settings['settings.' + key] = val;
      });

      UserGroup.update({_id: env.groups[0]}, settings, callback);
    };


    this.__.getter = function (keys, env, callback) {
      var result = {};

      keys.forEach(function (key) {
        var chains;

        if (1 === env[STORE_KEY].length) {
          result[key] = env[STORE_KEY].settings[key];
          result[key].strict = env[STORE_KEY][0].restrictive;
          return;
        }

        // TODO: rework to support non-boolean vals as well

        // separate strict and non-strict values
        chains = {OR: [], AND: []};
        env[STORE_KEY].forEach(function (g) {
          var op;

          // get default value of key if group have no setting for it
          if (!g.settings[key] || undefined === g.settings[key].value) {
            g.settings[key] = {value: self.getDefaultsFor(key)};
            // invert default value on restricive groups
            if (g.restrictive) {
              g.settings[key] = !g.settings[key];
            }
          }

          op = g.restrictive ? 'AND' : 'OR';
          chains[op].push(!!g.settings[key].value);
        });

        result[key] = {strict: false, value: false};

        if (0 < chains.AND.length) {
          result[key].strict = true;
        }

        if (0 === chains.OR.length) {
          result[key].value = !Underscore.include(chains.AND, false);
        } else {
          result[key].value = Underscore.include(chains.OR, true) && !Underscore.includes(chains.AND, false);
        }
      });

      callback(null, result);
    };
  };


  Store.adopts(UserGroupStore);


  callback(null, new UserGroupStore());
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
