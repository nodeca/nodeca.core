// Set default layout for admin panel pages.


'use strict';


module.exports = function (N) {
  N.wire.skip('server_chain:http:admin.*', 'layout_common_set');

  N.wire.before('server_chain:http:admin.*', function layout_admin_set(env) {
    env.res.layout = 'admin.core.layout';
  });
};
