// Set default domain for all cookies using `general_cookies_domain` setting.


'use strict';


var _ = require('lodash');


module.exports = function (N) {
  N.wire.after([ 'responder:http', 'responder:rpc' ], { priority: 45 }, async function cookies_domain_default(env) {
    let domain;

    try {
      domain = await N.settings.get('general_cookies_domain');
    } catch (err) {
      env.err = err;
      return;
    }

    if (_.isEmpty(domain)) return;

    _.forEach(env.extras.setCookie.storage, data => {
      if (_.isEmpty(data.options.domain)) {
        data.options.domain = domain;
      }
    });
  });
};
