"use strict";


/*global N*/



// internal
var get_menu_permissions = require('../../menu').get_menu_permissions;


////////////////////////////////////////////////////////////////////////////////


// Middleware that injects menus configuration into the environment.
//
//
// ##### See Also
//
// - [[shared.menus.build]]
//
N.wire.after('server:**', { priority: 50 }, function inject_menu(env, callback) {
  var ids = ['common', env.request.namespace],
      data = env.response.data;

  if (true) { // jshint workaround
    // TODO: menu injector will be removed later. At th moment it fails with
    //       stack overflow
    N.logger.warn('inject_menu() disabled (see: ' + __filename + ')');
    callback();
    return;
  }

  if (!env.origin.http || !env.session) {
    callback(null);
    return;
  }

  env.extras.puncher.start('Calc menu permissions');

  get_menu_permissions(ids, env, function (err, perms) {
    data.menus = N.shared.menus.build(ids, perms, N.runtime.router);
    env.extras.puncher.stop();
    callback(err);
  });
});
