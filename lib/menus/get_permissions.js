"use strict";


/*global N, underscore*/


// 3rd-party
var _     = underscore;
var async = require('async');


// internal
var walkMenus = require('./walk');


////////////////////////////////////////////////////////////////////////////////


// dummy function that interrupts execution after all before filters
//
function skipper(params, next) {
  next({allowed: true});
}


// get server method names, of items with check_permissions
//
function getMethods(menu) {
  var methods = [];

  _.each(menu, function (opts) {
    if (opts.to && opts.check_permissions) {
      methods.push(opts.to);
    }

    if (opts.submenu) {
      methods = methods.concat(getMethods(opts.submenu));
    }
  });

  return methods;
}


////////////////////////////////////////////////////////////////////////////////


/**
 *  get_menu_permissions(menu_ids, env, callback) -> Void
 *  - menu_ids (Array): list of menu ids to build permissions map for
 *  - env (Object): Base env object
 *  - callback (Function):
 *
 *  Builds a map permissions for all unique methods (from all requested menus).
 *
 *
 *  ##### Example
 *
 *  Given two menus with items pointing to several server methods:
 *
 *      - menu_id: users_nav
 *        items:
 *          - nodeca.server.users.create
 *          - nodeca.server.users.find
 *          - nodeca.server.users.list
 *      - menu_id: user_info_nav
 *        items:
 *          - nodeca.server.users.info
 *          - nodeca.server.users.list
 *
 *  Requesting menu permissions for `['users_nav', 'user_info_nav']` will give
 *  us an object with following structure:
 *
 *      var ids = ['users_nav', 'user_info_nav'];
 *      get_menu_permissions(ids, env, function (err, permissions) {
 *        // permissions -> {
 *        //   "users.create": false,
 *        //   "users.find": true,
 *        //   "users.list": true,
 *        //   "users.info": true
 *        // }
 *      });
 **/
module.exports = function (menu_ids, callback) {
  var methods = [];

  walkMenus(menu_ids, function (ns, id, menu) {
    methods = methods.concat(getMethods(menu));
  });

  // FIXME: This should be cached somehow

  async.map(_.uniq(methods), function (name, next) {
    // TODO: should actually run permission tests
    next(null, {name: name, result: true});
  }, function (err, results) {
    var map = {};
    results.forEach(function (o) { map[o.name] = o.result; });
    callback(err, map);
  });
};
