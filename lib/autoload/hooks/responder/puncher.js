// Write puncher stats to the capped collection
//

'use strict';


const createToken = require('nodeca.core/lib/app/random_token');


module.exports = function (N) {

  // Stop puncher and add puncher data to response
  //
  N.wire.after([ 'responder:http', 'responder:rpc' ], { priority: 20 }, async function puncher_end(env) {
    var puncher = env.extras.puncher;

    // Do nothing on errors, that relax puncher scopes pairing
    if (env.err) return;

    // Skip on JSON requests
    if (((env.origin.req.headers || {})['x-requested-with'] === 'XMLHttpRequest') &&
        (env.req.type === 'http')) {
      return;
    }

    // Close interval "puncher_end" for this method itself
    puncher.stop();

    // Close root interval "Total", opened on env create
    puncher.stop();

    // Check that all scopes were closed
    if (!env.extras.puncher.stopped) {
      env.err = new Error('Some of puncher scopes were not closed in ' + env.method);
      return;
    }

    let secret_key = createToken();

    // Write puncher data to database
    let result = await N.models.core.PuncherStats.collection.insertOne({
      secret_key,
      data:  JSON.stringify(env.extras.puncher.result)
    });

    // send stats in a cookie rather than env.res to keep body checksum constant
    env.extras.setCookie('stats-id', `${result.insertedId}_${secret_key}`, { httpOnly: false });
  });
};
