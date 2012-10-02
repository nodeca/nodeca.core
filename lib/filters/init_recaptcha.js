"use strict";

/*global nodeca*/


// Push ReCaptchs keys to `runtime` (transfered to browser)
//
nodeca.filters.after('', { weight: 50 }, function init_recaptcha(params, next) {
  this.runtime.recaptcha = {
    public_key: nodeca.config.recaptcha.public_key
  };
  next();
});
