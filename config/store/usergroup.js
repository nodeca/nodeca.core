var $$ = require('nodeca-lib').Utilities;


module.exports = (function (app, callback) {
  var store = {};


  store.preload = function (env, callback) {
    // grab user groups from user
    if (undefined == env.groups && env.user && env.user.groups) {
      env.groups = env.user.groups;
    }

    // env.grous was neither specified directly nor found in user
    if (!Array.isArray(env.groups) || 0 == env.groups.length) {
      callback(Error("Can't find list of groups"));
      return;
    }

    // got list of groups ids - preload objects
    if ('number' === typeof env.groups[0]) {
      app.model('usergroup')
      .where('_id').in(env.groups)
      .exec(function (err, groups) {
        env.groups = groups;
        callback(err);
      });
      return;
    }

    // everything is ready
    callback();
  };


  store.setter = function (data, env, callback) {
    var UserGroup = app.model('usergroup'),
        joint = new Promise.Joint(),
        settings = {};

    // prepare data to be set
    $$.each(data, function (key, val) { settings['settings.' + key] = val; });

    // call update for each group
    env.groups.forEach(function (g) {
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


  store.getter = function (keys, env, callback) {
    var result = {};

    $$.each(keys, function(key, val) {
      results[key] = $$.map(env.groups, function (grp) {
        return grp.settings[key];
      });
    });

    callback(null, result);
  };


  callback(null, store);
});


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
