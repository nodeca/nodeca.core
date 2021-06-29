// Push ReCaptcha's keys to `runtime` (transfered to browser)
//

'use strict';

module.exports = function (N) {

  N.wire.after('server_chain:http:*', { priority: 80 }, function recaptcha_pubkey_inject(env) {
    if (N.config.options?.recaptcha?.public_key) {
      env.runtime.recaptcha = {
        public_key: N.config.options.recaptcha.public_key
      };
    }
  });
};
