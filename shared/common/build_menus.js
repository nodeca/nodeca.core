"use strict";


/*global nodeca*/


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
 *      //            title: "Profile",
 *      //            link: "http://nodeca.org/user/profile"
 *      //          },
 *      //          // ...
 *      //        ]
 *      //      },
 *      //
 *      //      admin: {
 *      //        "system-sidebar": [
 *      //          {
 *      //            title: "Tools & Settings",
 *      //            childs: [
 *      //              {
 *      //                title: "System Settings",
 *      //                link: "http://nodeca.org/admin/settings",
 *      //                childs: [
 *      //                  {
 *      //                    title: "Performance Mode",
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
module.exports = function (menu_ids, menu_permissions, router) {
  return {};
};
