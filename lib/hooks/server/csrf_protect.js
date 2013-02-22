// - inject CSRF on http request
// - validate CSRF on rpc request
//

'use strict';


module.exports = function (N) {

  var rnd = require('../../rnd');

  N.wire.before('server:**:http', { priority: -75 }, function csrf_set_token(env, callback) {
    // No session - skip CSRF protection
    if (!env.session) {
      callback();
      return;
    }

    // Generate CSRF token if it was not yet set
    env.session.csrf = env.session.csrf || rnd();

    // Place to page injector
    env.runtime.csrf = env.session.csrf;

    callback();
  });


  N.wire.before('server:**:rpc', { priority: -75 }, function csrf_check_token(env, callback) {
    // No session - skip CSRF protection
    if (!env.session) {
      callback();
      return;
    }

    // Upon RPC request - validate CSRF token
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
