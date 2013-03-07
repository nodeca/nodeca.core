// Inject Puncher info into page
// 1. only when no errors
// 2. Immediately after http renderer
//

'use strict';


var render = require('../../../system/render/common');


var MACRO = '<!--{{PUNCHER_STATS}}-->';


////////////////////////////////////////////////////////////////////////////////


module.exports = function (N) {
  N.wire.after('responder:http', { priority: 21 }, function puncher_inject_http(env) {
    var result;

    if (!env.err && env.body && -1 !== env.body.indexOf(MACRO)) {
      result = render(N.views, 'common.debug_timeline', env.response.data);

      env.body = env.body.replace(MACRO, result);
    }
  });
};
