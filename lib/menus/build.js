"use strict";


// 3rd-party
var _ = require('lodash');


// internal
var walkMenus = require('./walk');


////////////////////////////////////////////////////////////////////////////////


// main function that actually builds a menu tree
function build(ns, cfg, permissions, linkTo) {
  var menu = [];

  _.each(cfg, function (opts, key) {
    var item;

    if (false === permissions[opts.to]) {
      // permission denied. skip.
      return;
    }

    var array_ns = ns.split('.');

    item = {
      title:    '@' + array_ns[0] + '.' + 'menus.' + array_ns.slice(1).join('.') + '.' + key,
      priority: opts.priority
    };

    if (opts.to) {
      item.to   = opts.to;
      item.link = linkTo(opts.to, opts.params);
    }

    if (opts.submenu) {
      item.childs = build(ns + '.' + key, opts.submenu, permissions, linkTo);
    }

    menu.push(item);
  });

  return _.sortBy(menu, function (item) {
    var prio = (undefined === item.priority) ? 100 : +item.priority;
    delete item.priority;
    return prio;
  });
}


/**
 *  shared.menus.build(menu_ids, permissions_map, linkTo) -> Object
 *  - menu_ids (Array):
 *  - permissions_map (Object):
 *  - linkTo (Pointer)
 *
 *  ##### Example
 *
 *      var permissions_map = env.response.permissions_map,
 *          linkTo          = env.link_to;
 *
 *      build_menus(['admin', 'common'], permissions_map, linkTo);
 *      // ->
 *      //    {
 *      //      common: {
 *      //        navbar: [
 *      //          {
 *      //            title: menus.common.navbar.profile,
 *      //            link: "http://nodeca.org/user/profile",
 *      //            to: "users.profile"
 *      //          },
 *      //          // ...
 *      //        ]
 *      //      },
 *      //
 *      //      admin: {
 *      //        "system-sidebar": [
 *      //          {
 *      //            title: menus.admin.system-sidebar.system,
 *      //            childs: [
 *      //              {
 *      //                title: menus.admin.system-sidebar.system.settings,
 *      //                link: "http://nodeca.org/admin/settings",
 *      //                to: "admin.settings.index"
 *      //                childs: [
 *      //                  {
 *      //                    title: menus.admin.system-sidebar.system.performance,
 *      //                    link: "http://nodeca.org/admin/performance",
 *      //                    to: "admin.performance.dashboard"
 *      //                  },
 *      //                  // ...
 *      //                ]
 *      //              }
 *      //            ]
 *      //          }
 *      //        ]
 *      //      }
 *      //    }
 **/
module.exports = function (menu_ids, permissions_map, linkTo) {
  var menus = {};

  permissions_map = permissions_map || {};

  walkMenus(menu_ids, function (ns, id, cfg) {
    menus[ns]     = menus[ns] || {};
    menus[ns][id] = build(ns + '.' + id, cfg, permissions_map, linkTo);
  });

  return menus;
};
