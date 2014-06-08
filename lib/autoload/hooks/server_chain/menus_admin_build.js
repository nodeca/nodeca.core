// Build admin menus data into env.runtime to access it from view templates.


'use strict';


var _              = require('lodash');
var buildMenu      = require('../../../menus/build');


module.exports = function (N) {
  N.wire.after('server_chain:http:admin.*', { priority: 80 }, function menus_admin_build(env) {

    env.extras.puncher.start('build admin menus');

    env.runtime.menus = env.runtime.menus || {};
    env.runtime.menus = _.extend(
      env.runtime.menus,
      buildMenu(N, ['admin'])
    );

    env.extras.puncher.stop();
  });
};
