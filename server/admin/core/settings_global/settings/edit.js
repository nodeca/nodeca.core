'use strict';


var _ = require('lodash');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    group: {
      type: 'string'
    , required: false
    }
  });


  N.wire.on(apiPath, function (env, callback) {
    var store      = N.settings.getStore('global')
      , settings   = env.response.data.settings   = []
      , categories = env.response.data.categories = []
      , settingsConfig;

    if (!store || !N.config.setting_schemas) {
      callback();
      return;
    }

    settingsConfig = N.config.setting_schemas['global'];

    if (!settingsConfig) {
      callback();
      return;
    }

    _.forEach(settingsConfig, function (config, name) {
      if (config && env.params.group === (config.group_key || null)) {
        settings.push(_.extend({ name: name }, config));
      }
    });

    settings.sort(function (a, b) {
      var ap = a.priority || 0
        , bp = b.priority || 0;

      if (ap === bp) {
        return a.name.localeCompare(b.name);
      } else {
        return ap - bp;
      }
    });

    _.forEach(settings, function (config) {
      if (config.category_key && !_.contains(categories, config.category_key)) {
        categories.push(config.category_key);
      }
    });

    store.get(_.pluck(settings, 'name'), {}, function (err, data) {
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
