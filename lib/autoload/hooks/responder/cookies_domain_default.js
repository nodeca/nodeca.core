// Set default domain for all cookies using `general_cookies_domain` setting.


'use strict';


module.exports = function (N) {
  N.wire.after([ 'responder:http', 'responder:rpc' ], { priority: 45 }, async function cookies_domain_default(env) {
    let domain;

    try {
      domain = await N.settings.get('general_cookies_domain');
    } catch (err) {
      env.err = err;
      return;
    }

    if (!domain) return;

    for (let data of Object.values(env.extras.setCookie.storage)) {
      data.options.domain = data.options.domain ?? domain;
    }
  });
};
