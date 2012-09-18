"use strict";


/*global nodeca*/


// nodeca
var NLib = require('nlib');


// 3rd-party
var Async = NLib.Vendor.Async;


// internal
var get_menu_permissions = require('../menu').get_menu_permissions;


////////////////////////////////////////////////////////////////////////////////


// Middleware that injects menus configuration into the environment.
//
//
// ##### See Also
//
// - [[shared.common.menus.build]]
//
nodeca.filters.after('', { weight: 50 }, function inject_menu(params, callback) {
  var ids = ['common', this.request.namespace],
      data = this.response.data,
      env = this;

  nodeca.debug_trace('inject_menu()', params);

  if (!this.origin.http || !this.session) {
    callback(null);
    return;
  }

  env.extras.puncher.start('Calc menu permissions');

  get_menu_permissions(ids, this, function (err, perms) {
    data.menus = nodeca.shared.common.menus.build(ids, perms, nodeca.runtime.router);
    env.extras.puncher.stop();
    callback(err);
  });
});
