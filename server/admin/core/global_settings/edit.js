'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    group: { type: 'string', required: false }
  });


  N.wire.before(apiPath, function check_if_group_exists(env) {
    if (!N.config.setting_groups.hasOwnProperty(env.params.group)) {
      throw N.io.NOT_FOUND;
    }
  });


  N.wire.before(apiPath, function prepare_response_data(env) {
    env.res.setting_schemas = {};
    env.res.setting_values  = {};
  });


  N.wire.before(apiPath, async function prepare_setting_schemas(env) {
    let config = N.config.setting_schemas.global;
    let keys = Object.keys(config);

    for (let i = 0; i < keys.length; i++) {
      let name = keys[i];
      let schema = config[name];

      if (schema.group_key !== env.params.group) {
        continue;
      }

      // Expose static schemas as is
      if (typeof schema.values !== 'function') {
        env.res.setting_schemas[name] = schema;
        continue;
      }

      // If schema `values` is a function, we need to compute it.
      schema = Object.assign({}, schema); // Keep original schema untouched.

      // Replace the function with computed values.
      schema.values = await schema.values();

      env.res.setting_schemas[name] = schema;
    }
  });


  N.wire.on(apiPath, async function global_settings_edit(env) {
    let parentGroup = N.config.setting_groups[env.params.group].parent;

    env.res.head.title = env.t('title', {
      parent_group: env.t('@admin.core.group_names.' + parentGroup),
      group: env.t('@admin.core.group_names.' + env.params.group)
    });

    let settings = await N.settings.getStore('global').get(
      Object.keys(env.res.setting_schemas),
      {},
      { skipCache: true }
    );

    for (let [ name, result ] of Object.entries(settings)) {
      env.res.setting_values[name] = result.value;
    }
  });
};
