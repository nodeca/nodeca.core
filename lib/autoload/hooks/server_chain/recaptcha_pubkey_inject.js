// Push ReCaptcha's keys to `runtime` (transfered to browser)
//

'use strict';

module.exports = function (N) {

  N.wire.after('server_chain:http:*', { priority: 80 }, function recaptcha_pubkey_inject(env) {
    env.runtime.recaptcha = {};

    if (N.config.options &&
        N.config.options.recaptcha &&
        N.config.options.recaptcha.public_key) {
      env.runtime.recaptcha.public_key = N.config.options.recaptcha.public_key;
    }
  });
};
