"use strict";


/*global nodeca, _ */


function build(ns, cfg, permissions, router) {
  var menu = [];

  _.each(cfg, function (opts, key) {
    var item;

    if (false === permissions[opts.to]) {
      // permission denied. skip.
      return;
    }

    var array_ns = ns.split('.');
    item = {
      title: array_ns[0] + '.' + 'menus.' + array_ns.slice(1) + '.' + key,
      priority: opts.priorit
    };

    if (opts.to) {
      item.to = opts.to;
      item.link = router.linkTo(opts.to, opts.params);
    }

    if (opts.submenu) {
      item.childs = build(ns + '.' + key, opts.submenu, permissions, router);
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
 *  nodeca.shared.common.build_menus(menu_ids, permissions_map, router) -> Object
 *  - menu_ids (Array):
 *  - permissions_map (Object):
 *  - router (Pointer)
 *
 *  ##### Example
 *
 *      var permissions_map = env.response.permissions_map,
 *          router          = nodeca.runtime.router;
 *
 *      nodeca.shared.build_menus(['admin', 'common'], permissions_map, router);
 *      // ->
 *      //    {
 *      //      common: {
 *      //        navbar: [
 *      //          {
 *      //            title: menus.common.navbar.profile,
 *      //            link: "http://nodeca.org/user/profile"
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
 *      //                childs: [
 *      //                  {
 *      //                    title: menus.admin.system-sidebar.system.performance,
 *      //                    link: "http://nodeca.org/admin/performance"
 *      //                  },
 *      //                  // ...
 *      //                ]
 *      //              }
 *      //            ]
 *      //          }
 *      //        ]
 *      //      }
 *      //    }
 */
module.exports = function (menu_ids, permissions_map, router) {
  var menus = {};

  permissions_map = permissions_map || {};

  nodeca.shared.common.menus.walk(menu_ids, function (ns, id, cfg) {
    menus[ns]     = menus[ns] || {};
    menus[ns][id] = build(ns + '.' + id, cfg, permissions_map, router);
  });

  return menus;
};
