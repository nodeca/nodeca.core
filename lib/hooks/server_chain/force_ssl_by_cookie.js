// Force SSL connection if user have "force_ssl" cookie.
// Used for logged-in users which opened Nodeca via plain HTTP in order to
// receive user's session id on next secure request.


'use strict';


module.exports = function (N) {
  N.wire.before('server_chain:*', { priority: -83 }, function force_ssl_by_cookie(env) {
    if (!env.extras.forceSSL && env.extras.getCookie('force_ssl')) {
      env.extras.forceSSL = true;
    }
  });
};
