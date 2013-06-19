// Set default domain for all cookies using `general_cookies_domain` setting.


'use strict';


var _ = require('lodash');


module.exports = function (N) {
  N.wire.after('responder:*', { priority: 95 }, function cookies_default_domain(env, callback) {
    N.settings.get('general_cookies_domain', function (err, domain) {
      if (err) {
        env.status = N.io.APP_ERROR;

        if ('development' === N.runtime.env) {
          env.body = 'Cannot read default cookie domain setting: ' +
                     err.stack || err.message || err.toString();
        } else {
          env.body = '[500] Internal Server Error';
        }

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
