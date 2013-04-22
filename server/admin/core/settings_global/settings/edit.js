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
    var config  = N.config.setting_schemas['global']
      , store   = N.settings.getStore('global')
      , schemas = env.response.data.setting_schemas = {}
      , values  = env.response.data.setting_values  = {};

    _.forEach(config, function (schema, name) {
      if (schema.group_key === env.params.group) {
        schemas[name] = schema;
      }
    });

    store.get(_.keys(schemas), {}, function (err, data) {
      if (err) {
        callback(err);
        return;
      }

      _.forEach(data, function (result, name) {
        values[name] = result.value;
      });

      callback();
    });
  });
};
