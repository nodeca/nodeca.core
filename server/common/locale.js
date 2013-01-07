'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    locale: { type: 'string', required: true }
  });

  return function (params, next) {
    if (-1 === N.config.locales.enabled.indexOf(params.locale)) {
      params.locale = N.config.locales['default'];
    }

    this.session.locale = params.locale;
    next();
  };
};
