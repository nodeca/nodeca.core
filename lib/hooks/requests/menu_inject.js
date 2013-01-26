// Inject menus configuration into the environment.
//
//
// ##### See Also
//
// - [[shared.menus.build]]
//

"use strict";


module.exports = function (N) {

  var getPermissions  = require('../../menus/get_permissions');
  var buildMenu       = require('../../menus/build');

  N.wire.after('server:**', { priority: 50 }, function inject_menu(env, callback) {
    var ids = ['common', env.request.namespace],
        data = env.response.data;

    if (!env.origin.http || !env.session) {
      callback(null);
      return;
    }

    env.extras.puncher.start('Calc menu permissions');

    getPermissions(ids, function (err, perms) {
      data.menus = buildMenu(ids, perms, N.runtime.router);
      env.extras.puncher.stop();
      callback(err);
    });
  });
};
