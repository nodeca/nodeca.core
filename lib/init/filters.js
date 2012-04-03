"use strict";


/*global nodeca*/


// nodeca
var NLib = require('nlib');


// 3rd-party
var Async = NLib.Vendor.Async;


// internal
var get_menu_permissions = require('nodeca.core/lib/menu').get_menu_permissions;
var router = nodeca.runtime.router;


// filter that runs after all actions
nodeca.filters.after('', function inject_menu(params, callback) {
  var ids = ['common', this.request.namespace],
      data = this.response.data;

  if ('HTTP' !== this.request.origin || 'common.menu_permissions' === this.request.method) {
    callback(null);
    return;
  }

  Async.waterfall([
    Async.apply(get_menu_permissions, ids),
    function (perms, next) {
      data.menus = nodeca.shared.common.build_menus(ids, perms, router);
      next();
    }
  ], callback);
});
