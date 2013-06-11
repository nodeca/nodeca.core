// Inject menus configuration into the environment.
//
//
// ##### See Also
//
// - [[shared.menus.build]]
//

'use strict';


module.exports = function (N) {

  var getPermissions = require('../../menus/get_permissions');
  var buildMenu      = require('../../menus/build');

  N.wire.after(['server_chain:http', 'server_chain:rpc'], { priority: 50 }, function inject_menu(env, callback) {

    var ids  = ['common', env.method.split('.').shift() ]
      , data = env.response.data;

    env.extras.puncher.start('Calc menu permissions');

    getPermissions(ids, function (err, perms) {
      data.menus = buildMenu(ids, perms, env.link_to);
      env.extras.puncher.stop();
      callback(err);
    });
  });
};
