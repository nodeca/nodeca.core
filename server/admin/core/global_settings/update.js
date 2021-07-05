'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    settings: { type: 'object', required: true }
  });


  N.wire.on(apiPath, async function global_settings_update(env) {
    let settings = {};

    for (let [ name, value ] of Object.entries(env.params.settings)) {
      settings[name] = { value };
    }

    try {
      await N.settings.getStore('global').set(settings, {});
    } catch (err) {
      throw { code: N.io.BAD_REQUEST, message: String(err) };
    }
  });
};
