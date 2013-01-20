"use strict";

/*global N*/


// Push ReCaptcha's keys to `runtime` (transfered to browser)
//
N.server.after('**', { priority: 50 }, function init_recaptcha(env, next) {
  if (env.origin.http) {
    env.runtime.recaptcha = {
      public_key: N.config.options.recaptcha.public_key
    };
  }

  next();
});
