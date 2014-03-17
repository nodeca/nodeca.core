// Build common menus data into env.runtime to access it from view templates.


'use strict';


var _              = require('lodash');
var getPermissions = require('../../../menus/get_permissions');
var buildMenu      = require('../../../menus/build');


module.exports = function (N) {
  // don't inject frontend menu to admin panel pages
  N.wire.skip('server_chain:http:admin.*', 'menus_common_build');

  N.wire.after('server_chain:http:*', { priority: 80 }, function menus_common_build(env, callback) {

    env.extras.puncher.start('build common menus');

    getPermissions(N, ['common'], function (err, perms) {
      env.runtime.menus = _.extend(
        {},
        env.runtime.menus,
        buildMenu(N, ['common'], perms)
      );
      env.extras.puncher.stop();
      callback(err);
    });
  });
};
