"use strict";


/*global nodeca*/


// nodeca
var NLib = require('nlib');


// 3rd-party
var Async = NLib.Vendor.Async;


// internal
var get_menu_permissions = require('nodeca.core/lib/menu').get_menu_permissions;


module.exports = function (params, callback) {
  var env = this;

  get_menu_permissions(params.menu_ids, env, function (err, permissions) {
    env.response.data = permissions;
    callback(err);
  });
};
