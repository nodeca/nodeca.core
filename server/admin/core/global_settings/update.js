'use strict';


const _ = require('lodash');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    settings: { type: 'object', required: true }
  });


  N.wire.on(apiPath, function* global_settings_update(env) {
    let settings = {};

    _.forEach(env.params.settings, (value, name) => {
      settings[name] = { value };
    });

    try {
      yield N.settings.getStore('global').set(settings, {});
    } catch (err) {
      throw { code: N.io.BAD_REQUEST, message: String(err) };
    }
  });
};
