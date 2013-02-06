// Inject Puncher info into page
// 1. only when no errors
// 2. Immediately after http renderer
//

"use strict";


module.exports = function (N) {

  N.wire.after('responder:http', { priority: 21 }, function puncher_inject_http(env) {
    if (!env.err && env.body) {
      env.body = env.body.replace('<!--{{PUNCHER_STATS}}-->',
        env.helpers.render('common.widgets.debug_timeline', env.response.data));
    }
  });
};
