// Push ReCaptcha's keys to `runtime` (transfered to browser)
//

'use strict';

module.exports = function (N) {

  N.wire.after('server_chain:http', { priority: 50 }, function init_recaptcha(env) {
    env.runtime.recaptcha = {
      public_key: N.config.options.recaptcha.public_key
    };
  });
};
