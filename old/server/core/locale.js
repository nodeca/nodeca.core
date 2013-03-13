'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    locale: { type: 'string', required: true }
  });

  N.wire.on(apiPath, function (env, next) {
    if (-1 === N.config.locales.enabled.indexOf(env.params.locale)) {
      env.params.locale = N.config.locales['default'];
    }

    env.session.locale = env.params.locale;
    next();
  });
};
