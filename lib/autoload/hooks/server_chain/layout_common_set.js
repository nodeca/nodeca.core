// Set default layout for all pages.


'use strict';


module.exports = function (N) {
  N.wire.before('server_chain:http:*', { priority: -10 }, function layout_common_set(env) {
    env.response.layout = 'common.layout';
  });
};
