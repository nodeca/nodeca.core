'use strict';


nodeca.validate({
  locale: { type: 'string', required: true }
});


module.exports = function (params, next) {
  if (-1 === nodeca.config.locales.enabled.indexOf(params.locale)) {
    params.locale = nodeca.config.locales['default'];
  }

  this.session.locale = params.locale;
  next();
};
