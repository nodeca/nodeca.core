// Generate a wrapper for a quote
//
'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    url: { type: 'string', required: true }
  });


  N.wire.on(apiPath, function quote_wrap(env, callback) {
    var data = {
      url: env.params.url
    };

    N.wire.emit('internal:common.content.quote_wrap', data, function (err) {
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
          env.res.html = data.html;
        }

        callback();
      });
    });
  });
};
