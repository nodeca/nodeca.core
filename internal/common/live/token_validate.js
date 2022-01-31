// Validate token for instant messaging
//
'use strict';


module.exports = function (N) {
  N.wire.on('internal.live.token_validate', async function live_token_validate(data) {
    // Fetch session ID from token record
    let session_id = await N.redis.get(`token_live:to_sid:${data.message.token}`);

    if (!session_id) return;

    data.token_valid = true;
  });
};
