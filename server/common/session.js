'use strict';

nodeca.validate('setLocale', {
  locale: { type: 'string', required: true }
});

module.exports.setLocale = function (params, next) {
  if (!params.locale) {
    params.locale = nodeca.config.locales['default'];
  }

  if (-1 === nodeca.config.locales.enabled.indexOf(params.locale)) {
    this.session.locale = params.locale;
    next();
    return;
  }

  next({ statusCode: 404, message: 'Unknown locale ' + params.locale });
};
