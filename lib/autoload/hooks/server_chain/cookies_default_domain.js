// Set default domain for all cookies using `general_cookies_domain` setting.


'use strict';


var _ = require('lodash');


module.exports = function (N) {
  N.wire.after('server_chain:*', { priority: 88, ensure: true }, function cookies_default_domain(env, callback) {
    N.settings.get('general_cookies_domain', function (err, domain) {
      if (err) {
        callback(err);
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
