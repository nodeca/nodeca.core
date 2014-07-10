// Set default domain for all cookies using `general_cookies_domain` setting.


'use strict';


var _ = require('lodash');


module.exports = function (N) {
  N.wire.after([ 'responder:http', 'responder:rpc' ], { priority: 45 }, function cookies_domain_default(env, callback) {
    N.settings.get('general_cookies_domain', function (err, domain) {
      if (err) {
        env.err = err;
        callback();
        return;
      }

      if (_.isEmpty(domain)) {
        callback();
        return;
      }

      _.forEach(env.extras.setCookie.storage, function (data) {
        if (_.isEmpty(data.options.domain)) {
          data.options.domain = domain;
        }
      });
      callback();
    });
  });
};
