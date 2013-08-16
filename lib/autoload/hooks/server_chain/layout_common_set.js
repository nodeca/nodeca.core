// Set default layout for all pages.


'use strict';


module.exports = function (N) {
  N.wire.before('server_chain:http:*', function layout_common_set(env) {
    env.res.layout = 'common.layout';
  });
};
