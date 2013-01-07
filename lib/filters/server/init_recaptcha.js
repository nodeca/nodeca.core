"use strict";

/*global N*/


// Push ReCaptcha's keys to `runtime` (transfered to browser)
//
N.filters.after('', { weight: 50 }, function init_recaptcha(params, next) {
  if (this.origin.http) {
    this.runtime.recaptcha = {
      public_key: N.config.options.recaptcha.public_key
    };
  }

  next();
});
