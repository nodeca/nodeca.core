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
    env.res.setting_schemas = {};
    env.res.setting_values  = {};
  });


  N.wire.before(apiPath, function prepare_setting_schemas(env, callback) {
    var config = N.config.setting_schemas.global;

    async.each(_.keys(config), function (name, next) {
      var schema = config[name];

      if (schema.group_key !== env.params.group) {
        next();
        return;
      }

      // Expose static schemas as is
      if (!_.isFunction(schema.values)) {
        env.res.setting_schemas[name] = schema;
        next();
        return;
      }

      // If schema `values` is a function, we need to compute it.
      schema = _.clone(schema); // Keep original schema untouched.
      schema.values(function (err, values) {
        schema.values = values; // Replace the function with computed values.
        env.res.setting_schemas[name] = schema;
        next(err);
      });
    }, callback);
  });


  N.wire.on(apiPath, function global_settings_edit(env, callback) {
    var parentGroup = N.config.setting_groups[env.params.group].parent;

    env.res.head.title =
      env.t('title', {
        parent_group: env.t('@admin.core.group_names.' + parentGroup),
        group: env.t('@admin.core.group_names.' + env.params.group)
      });

    N.settings.getStore('global').get(_.keys(env.res.setting_schemas),
                                      {},
                                      { skipCache: true },
                                      function (err, settings) {
      if (err) {
        callback(err);
        return;
      }

      _.forEach(settings, function (result, name) {
        env.res.setting_values[name] = result.value;
      });

      callback();
    });
  });
};
