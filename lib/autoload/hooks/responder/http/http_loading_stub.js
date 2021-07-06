// Show loading screen (splash screen) for users with active session
//

'use strict';


module.exports = function (N) {
  N.wire.after('responder:http', { priority: 9 }, function http_loading_stub(env) {
    let view    = env.res.view || env.method;
    let headers = env.origin.req.headers || {};

    // do not serialize data for XMLHttpRequest
    if (!N.views[view] || headers['x-requested-with'] === 'XMLHttpRequest') {
      return;
    }

    if (!env.user_info || !env.user_info.is_member) {
      return;
    }

    env.res.serialized_res = JSON.stringify(env.res);

    env.res.view = 'common.layout.loading_stub';

    if (env.method.indexOf('admin.') === 0) {
      env.res.view = 'admin.core.layout.loading_stub';
    }
  });
};
