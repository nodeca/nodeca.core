// Inject admin menus data into env.runtime to access it from view templates.


'use strict';


module.exports = function (N) {
  N.wire.after('server_chain:http:admin.*', { priority: 80 }, function navbar_admin_inject(env) {
    env.runtime.navbar = N.config.menus.admin.navbar;
  });
};
