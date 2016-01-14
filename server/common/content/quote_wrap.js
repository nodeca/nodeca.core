// Generate a wrapper for a quote
//
'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    url: { type: 'string', required: true }
  });


  N.wire.on(apiPath, function* quote_wrap(env) {
    let data = {
      url: env.params.url
    };

    yield N.wire.emit('internal:common.content.quote_wrap', data);

    let access_env = { params: { url: env.params.url, user_info: env.user_info } };

    yield N.wire.emit('internal:common.access', access_env);

    if (access_env.data.access_read) {
      env.res.html = data.html;
    }
  });
};
