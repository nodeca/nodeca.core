"use strict";


/*global nodeca*/


// nodeca
var NLib = require('nlib');


// 3rd-party
var Async = NLib.Vendor.Async;


// internal
var get_menu_permissions = require('nodeca.core/lib/menu').get_menu_permissions;


module.exports = function (next) {
  // filter that runs after all actions
  nodeca.filters.after('', function inject_menu(params, callback) {
    var ids = ['common', this.request.namespace],
        data = this.response.data;

    if ('HTTP' !== this.request.origin || 'common.menu_permissions' === this.request.method) {
      callback(null);
      return;
    }

    get_menu_permissions(ids, this, function (err, perms) {
      data.menus = nodeca.shared.common.menus.build(ids, perms, nodeca.runtime.router);
      callback(err);
    });
  });

  next();
};
