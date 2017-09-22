// Add session loader helper
//
//   data.getSession(function (err, session) {
//     // ...
//   });
//
'use strict';


module.exports = function (N) {
  N.wire.before('internal.live.*', { priority: -100 }, function add_session_loader(data) {
    data.getSession = async function () {
      // If session already loaded - skip
      if (data.__session__ || data.__session__ === null) {
        return data.__session__;
      }

      // Fetch session ID from token record
      let sessionID = await N.redis.getAsync('token_live:' + data.message.token);

      // Fetch session
      let rawData = await N.redis.getAsync('sess:' + sessionID);

      // If session not found
      if (!rawData) {
        data.__session__ = null;
        return data.__session__;
      }

      data.__session__ = JSON.parse(rawData);

      return data.__session__;
    };
  });
};
