// Add session loader helper
//
//   data.getSession(function (err, session) {
//     // ...
//   });
//
'use strict';

module.exports = function (N) {
  N.wire.before('internal.live.*', { priority: -100 }, function add_session_loader(data) {
    data.getSession = function (callback) {
      // If session already loaded - skip
      if (data.__session__ || data.__session__ === null) {
        callback(null, data.__session__);
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
            data.__session__ = null;
            callback(null, data.__session__);
            return;
          }

          try {
            data.__session__ = JSON.parse(rawData);
          } catch (__) {
            // If session data is broken
            callback('Session is broken');
            return;
          }

          callback(null, data.__session__);
        });
      });
    };
  });
};
