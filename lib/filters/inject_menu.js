/**
 *  lib.filters.inject_menu(params, callback) -> Void
 *
 *  Middleware that injects menus configuration into the environment.
 *
 *
 *  ##### See Also
 *
 *  - [[shared.common.menus.build]]
 **/


"use strict";


/*global nodeca*/


// nodeca
var NLib = require('nlib');


// 3rd-party
var Async = NLib.Vendor.Async;


// internal
var get_menu_permissions = require('../menu').get_menu_permissions;


// filter that runs after all actions
nodeca.filters.after('', {weight: 50}, function inject_menu(params, callback) {
  var ids = ['common', this.request.namespace],
      data = this.response.data;

  nodeca.debug_trace('inject_menu()', params);

  if (!this.origin.http || 'common.menus.permissions' === this.request.method) {
    callback(null);
    return;
  }

  get_menu_permissions(ids, this, function (err, perms) {
    data.menus = nodeca.shared.common.menus.build(ids, perms, nodeca.runtime.router);
    callback(err);
  });
});
