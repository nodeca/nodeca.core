/** section: nodeca.core
 *  lib.menu
 *
 *  Menu related functions
 **/


"use strict";


/*global nodeca, _*/


// nodeca
var NLib = require('nlib');


// 3rd-party
var Async = NLib.Vendor.Async;


// internal
var env = require('./env');


////////////////////////////////////////////////////////////////////////////////


// dummy function that interrupts execution after all before filters
function skipper(params, next) {
  next({allowed: true});
}


// creates new environment object see `env()` from the `base` env
function create_env(base, method) {
  return env({
    realtime: base.origin.realtime,
    http:     base.origin.http,
    session:  NLib.Support.deepClone(base.session),
    skip:     ['widgets'],
    method:   method,
    layout:   base.response.layout
  });
}


// get server method names, of items with check_permissions
function get_methods(menu) {
  var methods = [];

  _.each(menu, function (opts, key) {
    if (opts.to && opts.check_permissions) {
      methods.push(opts.to);
    }

    if (opts.submenu) {
      methods = methods.concat(get_methods(opts.submenu));
    }
  });

  return methods;
}


////////////////////////////////////////////////////////////////////////////////


/**
 *  lib.menu.get_menu_permissions(menu_ids, env, callback) -> Void
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
module.exports.get_menu_permissions = function (menu_ids, env, callback) {
  var methods = [];

  nodeca.shared.common.menus.walk(menu_ids, function (ns, id, menu) {
    methods = methods.concat(get_methods(menu));
  });

  // FIXME: This should be cached somehow

  Async.map(_.uniq(methods), function (name, next) {
    nodeca.filters.run(name, {}, skipper, function (err) {
      if (undefined === err.allowed && undefined === err.denied) {
        // generic error occured.
        nodeca.logger.error(
          "Failed to run permission test: " + (err.message || err),
          {name: name, env: env}
        );
      }

      next(null, {name: name, result: (!!err.allowed && !err.denied)});
    }, create_env(env, name));
  }, function (err, results) {
    var map = {};
    results.forEach(function (o) { map[o.name] = o.result; });
    callback(err, map);
  });
};
