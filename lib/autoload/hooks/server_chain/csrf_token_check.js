// - Inject CSRF on HTTP request.
// - Validate CSRF on RPC request.
//

'use strict';


const createToken = require('nodeca.core/lib/app/random_token');


module.exports = function (N) {

  N.wire.before('server_chain:http:*', { priority: -55 }, function csrf_token_set(env) {
    // No session - skip CSRF protection.
    if (!env.session) return;

    // Generate CSRF token if it was not yet set.
    env.session.token_csrf = env.session.token_csrf || createToken();

    // Set CSRF token as a cookie to make it available for javascript;
    // we avoid sharing it in runtime to make sure server response body
    // is the same for bots (so it has the same checksum for etags).
    if (env.session.token_csrf !== env.extras.getCookie('csrf-token')) {
      env.extras.setCookie('csrf-token', env.session.token_csrf, { httpOnly: false });
    }
  });


  N.wire.before('server_chain:rpc:*', { priority: -55 }, function csrf_token_check(env) {
    // No session - skip CSRF protection.
    if (!env.session) return;

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
      env.extras.setCookie('csrf-token', env.session.token_csrf, { httpOnly: false });
      throw N.io.INVALID_CSRF_TOKEN;
    }
  });
};
