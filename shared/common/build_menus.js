"use strict";


/*global nodeca */


// FIXME: This will not work in browser - we need cross-side solution
var _ = require('nlib').Vendor.Underscore;


function build(ns, cfg, perms, router) {
  var menu = [];

  _.each(cfg, function (opts, key) {
    var item;

    if (opts.check_permissions && false === perms[opts.to]) {
      // permission denied. skip.
      return;
    }

    item = {title: 'menus.' + ns + '.' + key};

    if (opts.to) {
      item.link = router.linkTo(opts.to);
    }

    if (opts.submenu) {
      item.childs = build(ns + '.' + key, opts.submenu, perms, router);
    }

    menu.push(item);
  });

  return menu;
}


/**
 *  nodeca.shared.common.build_menus(menu_ids, permissions_map, router) -> Object
 *  - menu_ids (Array):
 *  - permissions_map (Object):
 *  - router (Pointer)
 *
 *  ##### Example
 *
 *      var menu_ids = ['admin', 'common'],
 *          permissions_map = this.response.permissions_map,
 *          router = nodeca.runtime.router;
 *
 *      nodeca.shared.build_menus(menu_ids, permissions_map, router);
 *      // ->
 *      //    {
 *      //      common: {
 *      //        topnav: [
 *      //          {
 *      //            title: menus.common.topnav.profile,
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

  _.each(menu_ids, function (id) {
    var parts, ns, cfg;

    if (!_.isString(id)) {
      // non-valid id
      return;
    }

    parts = id.split('.'), ns = parts.shift(), cfg = nodeca.config.menus[ns];

    if (!cfg) {
      // no such namespace - skip
      return;
    }

    menus[ns] = {};
    id = parts.shift();

    if (id) {
      menus[ns][id] = build(ns + '.' + id, cfg[id] || {}, permissions_map, router);
    } else {
      _.each(cfg, function (cfg, id) {
        menus[ns][id] = build(ns + '.' + id, cfg, permissions_map, router);
      });
    }
  });

  return menus;
};
