// Auto-switch to HTTPS depending on env.extras.forceSSL


'use strict';


var _   = require('lodash');
var url = require('url');


var DEFAULT_HTTPS_PORT = 443;


module.exports = function (N) {

  var findHttpsPort = _.memoize(function (apiPath) {
    var splitted = apiPath.split('.'), matchedBind, foundBind;

    // Reduce apiPath looking for matching binds.
    while (!_.isEmpty(splitted)) {
      matchedBind = N.config.bind[splitted.join('.')];

      if (matchedBind && matchedBind.ssl) {
        foundBind = matchedBind;
        break; // Found.
      }

      splitted.pop();
    }

    // Use default at least.
    if (!foundBind && N.config.bind['default'].ssl) {
      foundBind = N.config.bind['default'];
    }

    // Fecth port number from 'address:port' string.
    if (foundBind) {
      return foundBind.ssl.listen.split(':')[1] || DEFAULT_HTTPS_PORT;
    } else {
      return DEFAULT_HTTPS_PORT;
    }
  });


  N.wire.before('server_chain:*', { priority: -1 }, function switch_to_https_if_needed(env) {
    if (!(env.extras.forceSSL && !env.request.isSecure)) {
      return; // No need to switch.
    }

    var httpsPort = findHttpsPort(env.method)
      , redirect  = url.parse(env.origin.req.fullUrl);

    redirect.protocol = 'https:';
    redirect.port     = DEFAULT_HTTPS_PORT !== httpsPort ? httpsPort : null;

    // Delete computed host, so url.format will use hostname + port.
    delete redirect.host;

    return {
      code: N.io.REDIRECT
    , head: { Location: url.format(redirect) }
    , switching_protocols: true // FIXME: Hack for RPC navigator
    };
  });
};
