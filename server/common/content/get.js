// Return contents for quote/snippet expansion
//
'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    url: { type: 'string', required: true }
  });


  N.wire.on(apiPath, function get_contents(env, callback) {
    var data = {
      url: env.params.url
    };

    N.wire.emit('internal:common.content.get', data, function (err) {
      if (err) {
        callback(err);
        return;
      }

      N.wire.emit('internal:common.access', env, function (err) {
        if (err) {
          callback(err);
          return;
        }

        if (env.data.access_read) {
          env.res.html   = data.html;
          env.data.users = data.users;
        }

        callback();
      });
    });
  });
};
