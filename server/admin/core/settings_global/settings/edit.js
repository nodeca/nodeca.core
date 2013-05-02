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
    var config = N.config.setting_schemas['global']
      , store  = N.settings.getStore('global')
      , data   = env.response.data;

    data.setting_schemas = {};
    data.setting_values  = {};

    if (!N.config.setting_groups.hasOwnProperty(env.params.group)) {
      callback(N.io.NOT_FOUND);
      return;
    }

    data.head.title =
      env.helpers.t('admin.core.settings_global.settings.edit.title', {
        group: env.helpers.t('admin.setting.group.' + env.params.group)
      });

    _.forEach(config, function (schema, name) {
      if (schema.group_key === env.params.group) {
        data.setting_schemas[name] = schema;
      }
    });

    store.get(_.keys(data.setting_schemas), {}, { skipCache: true }, function (err, settings) {
      if (err) {
        callback(err);
        return;
      }

      _.forEach(settings, function (result, name) {
        data.setting_values[name] = result.value;
      });

      callback();
    });
  });
};
