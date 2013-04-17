'use strict';


var _ = require('lodash');


function resultSorter(a, b) {
  var ap = a.priority || 0
    , bp = b.priority || 0;

  if (ap === bp) {
    return a.name.localeCompare(b.name);
  } else {
    return ap - bp;
  }
}


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    store: {
      type: 'string'
    , required: true
    }
  , group: {
      type: 'string'
    , required: false
    }
  , params: {
      type: 'object'
    , required: false
    , 'default': {}
    }
  });


  N.wire.on(apiPath, function (env, callback) {
    var store      = N.settings.getStore(env.params.store)
      , settings   = env.response.data.settings   = []
      , groups     = env.response.data.groups     = []
      , categories = env.response.data.categories = []
      , settingsConfig
      , groupsConfig;

    if (!store) {
      callback('Store not found: ' + env.params.store);
      return;
    }

    if (!N.config.setting_schemas) {
      callback();
      return;
    }

    settingsConfig = N.config.setting_schemas[env.params.store];
    groupsConfig   = N.config.setting_groups || {};

    if (!settingsConfig) {
      callback();
      return;
    }

    _.forEach(settingsConfig, function (config, name) {
      if (config && env.params.group === (config.group_key || null)) {
        settings.push(_.extend({ name: name }, config));
      }
    });

    _.forEach(groupsConfig, function (config, name) {
      if ((env.params.group || null) === (config ? config.parent : null)) {
        groups.push(_.extend({ name: name }, config));
      }
    });

    settings.sort(resultSorter);
    groups.sort(resultSorter);

    _.forEach(settings, function (config) {
      if (config.category_key && !_.contains(categories, config.category_key)) {
        categories.push(config.category_key);
      }
    });

    store.get(_.pluck(settings, 'name'), env.params.params, function (err, data) {
      if (err) {
        callback(err);
        return;
      }

      _.forEach(data, function (result, name) {
        _.extend(_.find(settings, function (s) { return s.name === name; }),
                 result);
      });

      callback();
    });
  });
};
