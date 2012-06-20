"use strict";


/*global nodeca*/


// nodeca
var NLib = require('nlib');


// 3rd-party
var Async = NLib.Vendor.Async;


// internal
var get_menu_permissions = require('../../menu').get_menu_permissions;


// filter that runs after all actions
nodeca.filters.after('', 50, function inject_menu(params, callback) {
  var ids = ['common', this.request.namespace],
      data = this.response.data;

  // by default it's an empty object
  data.menus = {};

  if (!this.origin.http || 'common.menu_permissions' === this.request.method) {
    callback(null);
    return;
  }

  get_menu_permissions(ids, this, function (err, perms) {
    data.menus = nodeca.shared.common.menus.build(ids, perms, nodeca.runtime.router);
    callback(err);
  });
});
