// Inject common menus data into env.runtime to access it from view templates.


'use strict';


module.exports = function (N) {
  // don't inject frontend menu to admin panel pages
  N.wire.skip('server_chain:http:admin.*', 'menus_common_inject');

  N.wire.after('server_chain:http:*', { priority: 80 }, function navbar_common_inject(env) {
    env.runtime.navbar = N.config.menus.common.navbar;
  });
};
