'use strict';


var _     = require('lodash');
var async = require('async');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    group: {
      type: 'string'
    , required: false
    }
  });


  N.wire.before(apiPath, function check_if_group_exists(env, callback) {
    if (!N.config.setting_groups.hasOwnProperty(env.params.group)) {
      callback(N.io.NOT_FOUND);
    } else {
      callback();
    }
  });


  N.wire.before(apiPath, function prepare_response_data(env) {
    env.response.data.setting_schemas = {};
    env.response.data.setting_values  = {};
  });


  N.wire.before(apiPath, function prepare_setting_schemas(env, callback) {
    var config = N.config.setting_schemas['global'];

    async.forEach(_.keys(config), function (name, next) {
      var schema = config[name];

      if (schema.group_key !== env.params.group) {
        next();
        return;
      }

      if (_.isFunction(schema.values)) {
        // If schema `values` is a function, we need to compute it.
        schema = _.clone(schema); // Keep original schema untouched.
        schema.values(function (err, values) {
          schema.values = values; // Replace the function with computed values.
          env.response.data.setting_schemas[name] = schema;
          next(err);
        });
      } else {
        // Otherwise it's a static schema - just expose it as is.
        env.response.data.setting_schemas[name] = schema;
        next();
      }
    }, callback);
  });


  N.wire.on(apiPath, function global_settings_edit(env, callback) {
    env.response.data.head.title =
      env.helpers.t('admin.core.global_settings.edit.title', {
        group: env.helpers.t('admin.core.group_names.' + env.params.group)
      });

    N.settings.getStore('global').get(_.keys(env.response.data.setting_schemas),
                                      {},
                                      { skipCache: true },
                                      function (err, settings) {
      if (err) {
        callback(err);
        return;
      }

      _.forEach(settings, function (result, name) {
        env.response.data.setting_values[name] = result.value;
      });

      callback();
    });
  });
};
