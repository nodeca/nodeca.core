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
    env.session.token_csrf = env.session.token_csrf || createToken();

    // Place to page injector.
    env.runtime.token_csrf = env.session.token_csrf;

    callback();
  });


  N.wire.before('server_chain:rpc:*', { priority: -55 }, function csrf_token_check(env, callback) {
    // No session - skip CSRF protection.
    if (!env.session) {
      callback();
      return;
    }

    // Generate CSRF token if session was reset previously.
    //
    // It could happen when e.g. you go to the /login page, then
    // FLUSHALL redis, and try to log in.
    //
    // This particular request will fail, but we send client
    // a new valid token to try again with.
    //
    env.session.token_csrf = env.session.token_csrf || createToken();

    // Upon RPC request - validate CSRF token.
    if (env.session.token_csrf !== env.origin.req.csrf) {
      callback({
        code: N.io.INVALID_CSRF_TOKEN,
        data: { token: env.session.token_csrf }
      });
      return;
    }

    callback();
  });
};
