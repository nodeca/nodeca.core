'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    offline: { type: 'boolean', required: true }
  });


  N.wire.on(apiPath, function* switch_mode(env) {
    yield N.settings.getStore('global').set(
      { general_offline_mode: { value: env.params.offline } }
    );
  });
};
