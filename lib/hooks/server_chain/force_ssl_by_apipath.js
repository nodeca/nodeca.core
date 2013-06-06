// Force SSL connection if currect method's ApiPath requires it.
// For example you may force SSL for login/register/etc by the following config:
//
//   bind:
//     users.auth:
//       force_ssl: true


'use strict';


var _ = require('lodash');


module.exports = function (N) {

  // Checks if `apiPath` is forced to use secure connection.
  //
  var checkForcedSSL = _.memoize(function (apiPath) {
    var splitted = apiPath.split('.');

    // Reduce apiPath looking for matching binds.
    while (!_.isEmpty(splitted)) {
      apiPath = splitted.join('.');

      if (_.has(N.config.bind, apiPath)) {
        if (N.config.bind[apiPath].force_ssl) {
          return true;
        }
      }

      splitted.pop();
    }

    return false;
  });


  N.wire.before('server_chain:*', { priority: -999 }, function force_ssl_by_apipath(env) {
    if (!env.extras.forceSSL && checkForcedSSL(env.method)) {
      env.extras.forceSSL = true;
    }
  });
};
