"use strict";

/*global nodeca*/


// Push ReCaptcha's keys to `runtime` (transfered to browser)
//
nodeca.filters.after('', { weight: 50 }, function init_recaptcha(params, next) {
  this.runtime.recaptcha = {
    public_key: nodeca.config.options.recaptcha.public_key
  };
  next();
});
