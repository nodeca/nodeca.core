// Validate token for instant messaging
//
'use strict';


module.exports = function (N) {
  N.wire.on('internal.live.token_validate', function* live_token_validate(data) {
    // Fetch session ID from token record
    let session_id = yield N.redis.getAsync(`token_live:${data.message.token}`);

    if (!session_id) return;

    // Check session exists
    let session_exists = yield N.redis.existsAsync(`sess:${session_id}`);

    if (session_exists) data.token_valid = true;
  });
};
