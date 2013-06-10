// Auto-switch to HTTP depending on env.extras.forceSSL
// Used to restrict guests use encrypted connections.


'use strict';


var _   = require('lodash');
var url = require('url');


var DEFAULT_HTTP_PORT = 80;


module.exports = function (N) {

  var findHttpPort = _.memoize(function (apiPath) {
    var splitted = apiPath.split('.'), matchedBind;

    // Reduce apiPath looking for matching binds.
    while (!_.isEmpty(splitted)) {
      matchedBind = N.config.bind[splitted.join('.')];

      if (matchedBind) {
        break; // Found.
      }

      splitted.pop();
    }

    // Use default at least.
    if (!matchedBind) {
      matchedBind = N.config.bind['default'];
    }

    // Fecth port number from 'address:port' string.
    if (matchedBind) {
      return matchedBind.listen.split(':')[1] || DEFAULT_HTTP_PORT;
    } else {
      return DEFAULT_HTTP_PORT;
    }
  });


  /*N.wire.before('server_chain:*', { priority: -2 }, function switch_to_http_if_needed(env) {
    if (!(env.request.isEncrypted && !env.extras.forceSSL)) {
      return; // No need to switch.
    }

    var httpPort = findHttpPort(env.method)
      , redirect = url.parse(env.origin.req.fullUrl);

    redirect.protocol = 'http:';
    redirect.port     = DEFAULT_HTTP_PORT !== httpPort ? httpPort : null;

    // Delete computed host, so url.format will use hostname + port.
    delete redirect.host;

    return {
      code: N.io.REDIRECT
    , head: { Location: url.format(redirect) }
    , switching_protocols: true // FIXME: Hack for RPC navigator
    };
  });*/
};
