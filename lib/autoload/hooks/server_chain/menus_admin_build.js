// Build admin menus data into env.runtime to access it from view templates.


'use strict';


var _              = require('lodash');
var getPermissions = require('../../../menus/get_permissions');
var buildMenu      = require('../../../menus/build');


module.exports = function (N) {
  N.wire.after('server_chain:http:admin.*', { priority: 80 }, function menus_admin_build(env, callback) {

    env.extras.puncher.start('build admin menus');

    getPermissions(N, ['admin'], function (err, perms) {
      env.runtime.menus = _.extend(
        {},
        env.runtime.menus,
        buildMenu(N, ['admin'], perms)
      );
      env.extras.puncher.stop();
      callback(err);
    });
  });
};
