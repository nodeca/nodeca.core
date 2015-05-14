// Add session loader helper
//
//   data.helpers.sessionLoad(function (err) {
//     if (err) {
//       callback(err);
//       return;
//     }
//
//     // `data.session` is available here
//   });
//
'use strict';

module.exports = function (N) {
  N.wire.before('internal.live.*', { priority: -100 }, function add_session_loader(data) {
    data.helpers = data.helpers || {};

    data.helpers.sessionLoad = function (callback) {
      // If session already loaded - skip
      if (data.session) {
        callback();
        return;
      }

      // Fetch session ID from token record
      N.redis.get('token_live:' + data.message.token, function (err, sessionID) {
        if (err) {
          callback(err);
          return;
        }

        // Fetch session
        N.redis.get('sess:' + sessionID, function (err, rawData) {
          if (err) {
            callback(err);
            return;
          }

          // If session not found
          if (!rawData) {
            callback('Session not found');
            return;
          }

          try {
            data.session = JSON.parse(rawData);
          } catch (__) {
            // If session data is broken
            callback('Session is broken');
            return;
          }

          callback();
        });
      });
    };
  });
};
