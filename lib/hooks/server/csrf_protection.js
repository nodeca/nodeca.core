// - inject CSRF on http request
// - validate CSRF on rpc request
//

'use strict';


module.exports = function (N) {

  var rnd = require('../../rnd');

  N.wire.before('server:**', { priority: -75 }, function csrf_protection(env, callback) {
    // No session - skip CSRF protection
    if (!env.session) {
      callback();
      return;
    }

    // Generate CSRF token if it was not yet set
    env.session.csrf = env.session.csrf || rnd();

    // Upon HTTP request we send csrf token
    if (env.origin.http) {
      env.runtime.csrf = env.session.csrf;
      callback();
      return;
    }

    // Upon RPC request - validate CSRF token
    if (env.origin.rpc && env.session.csrf !== env.origin.rpc.req.csrf) {
      callback({
        code: N.io.INVALID_CSRF_TOKEN,
        data: { token: env.session.csrf }
      });
      return;
    }

    callback();
  });
};