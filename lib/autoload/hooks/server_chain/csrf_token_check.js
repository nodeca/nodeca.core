// - Inject CSRF on HTTP request.
// - Validate CSRF on RPC request.
//

'use strict';


var createToken = require('nodeca.core/lib/random_token');


module.exports = function (N) {

  N.wire.before('server_chain:http:*', { priority: -55 }, function csrf_token_set(env, callback) {
    // No session - skip CSRF protection.
    if (!env.session) {
      callback();
      return;
    }

    // Generate CSRF token if it was not yet set.
    env.session.csrf = env.session.csrf || createToken();

    // Place to page injector.
    env.runtime.csrf = env.session.csrf;

    callback();
  });


  N.wire.before('server_chain:rpc:*', { priority: -55 }, function csrf_token_check(env, callback) {
    // No session - skip CSRF protection.
    if (!env.session) {
      callback();
      return;
    }

    // Upon RPC request - validate CSRF token.
    if (!env.session.csrf || (env.session.csrf !== env.origin.req.csrf)) {
      callback({
        code: N.io.INVALID_CSRF_TOKEN,
        data: { token: env.session.csrf }
      });
      return;
    }

    callback();
  });
};
