// Inject timeline generator
//

'use strict';


module.exports = function (N) {

  // Stop puncher and add puncher data to response
  //
  N.wire.after([ 'responder:http', 'responder:rpc' ], { priority: 20 }, function puncher_end(env) {

    // Do nothing on errors, that relax puncher scopes pairing
    if (env.err) { return; }

    // Skip on JSON requests
    if (((env.origin.req.headers || {})['x-requested-with'] === 'XMLHttpRequest') &&
        (env.req.type === 'http')) {
      return;
    }

    // Stop puncher & check that all scopes were closed
    if (!env.extras.puncher.stop().stopped) {
      env.err = new Error('Some of puncher scopes were not closed in ' + env.method);
      return;
    }

    // Push puncher data to response
    env.res.puncher_stats = env.extras.puncher.result;
  });
};
