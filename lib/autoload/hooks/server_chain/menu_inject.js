// Inject menus configuration into the environment.
//
//
// ##### See Also
//
// - [[shared.menus.build]]
//

'use strict';


module.exports = function (N) {

  var getPermissions = require('../../../menus/get_permissions');
  var buildMenu      = require('../../../menus/build');

  N.wire.after(['server_chain:http'], { priority: 80 }, function menu_inject(env, callback) {

    var ids = ['common', env.method.split('.').shift() ];

    env.extras.puncher.start('Calc menu permissions');

    getPermissions(ids, function (err, perms) {
      env.runtime.menus = buildMenu(ids, perms, N.runtime.router);
      env.extras.puncher.stop();
      callback(err);
    });
  });
};
