// Build common menus data into env.runtime to access it from view templates.


'use strict';


var _              = require('lodash');
var getPermissions = require('../../../menus/get_permissions');
var buildMenu      = require('../../../menus/build');


module.exports = function (N) {
  N.wire.after('server_chain:http:*', { priority: 80 }, function menus_common_build(env, callback) {

    env.extras.puncher.start('Build common menus');

    getPermissions(['common'], function (err, perms) {
      _.extend(env.runtime.menus, buildMenu(['common'], perms, N.runtime.router));
      env.extras.puncher.stop();
      callback(err);
    });
  });
};
