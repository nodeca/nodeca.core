'use strict';

/*global N*/

N.validate({
  locale: { type: 'string', required: true }
});


module.exports = function (params, next) {
  if (-1 === N.config.locales.enabled.indexOf(params.locale)) {
    params.locale = N.config.locales['default'];
  }

  this.session.locale = params.locale;
  next();
};
