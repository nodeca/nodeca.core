// Fetch actual token for instant messaging
//
'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});


  // Send actial token
  //
  N.wire.on(apiPath, function token_live_get(env) {
    env.res.token_live = env.session.token_live;
  });
};
