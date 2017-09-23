// Return contents for quote/snippet expansion
//
'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    url: { type: 'string', required: true }
  });


  N.wire.on(apiPath, async function get_contents(env) {
    let data = {
      url: env.params.url
    };

    await N.wire.emit('internal:common.content.get', data);

    let access_env = { params: { url: env.params.url, user_info: env.user_info } };

    await N.wire.emit('internal:common.access', access_env);

    if (access_env.data.access_read) {
      env.res.html   = data.html;
      env.data.users = data.users;
    }
  });
};
