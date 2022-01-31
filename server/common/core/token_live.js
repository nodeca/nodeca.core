// - Create new token on client request
// - Inject token to runtime for http requests
// - Save token or update TLL
//
'use strict';


const createToken = require('nodeca.core/lib/app/random_token');


const MAX_LIVE_TOKEN_TTL = 24 * 60 * 60; // 24 hours


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  // Create Faye token if not exists
  //
  N.wire.on(apiPath, async function token_live_create(env) {

    let token_live = await N.redis.get(`token_live:from_sid:${env.session_id}`);

    if (!token_live || !createToken.validate(token_live)) {
      token_live = createToken();
    }

    await N.redis.multi()
      .set(
        `token_live:from_sid:${env.session_id}`, token_live,
        'EX', MAX_LIVE_TOKEN_TTL
      )
      .set(
        `token_live:to_sid:${token_live}`, env.session_id,
        'EX', MAX_LIVE_TOKEN_TTL
      )
      .exec();

    env.res.token_live = token_live;
  });
};
