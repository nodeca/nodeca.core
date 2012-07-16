"use strict";


/**
 *  shared
 **/

/**
 *  shared.common
 **/

/**
 *  shared.common.menus
 **/


/*global nodeca, _ */


/**
 *  shared.common.menus.walk(menu_ids, iterator(ns, id, config)) -> Void
 *  - menu_ids (Array): List of menus to iterate through
 *  - iterator (Function): An iterator function to be called on each menu
 *
 *  Calls iterator on menu configuration for the list of given menu ids. Each
 *  menu id can be a namespace, e.g. `blogs` in this case iterator will be
 *  called with configuration of all menus in the `blogs` namespace, or a full
 *  menu ns + id path, e.g. `blogs.post_actions`.
 **/
module.exports = function (menu_ids, iterator) {
  _.each(menu_ids, function (id) {
    var parts, ns, cfg;

    if (!_.isString(id)) {
      // non-valid id
      return;
    }

    parts = id.split('.');
    ns    = parts.shift();
    id    = parts.shift();
    cfg   = nodeca.config.menus[ns];

    if (!cfg) {
      // invalid menu namespace
      return;
    }

    if (!!id) {
      iterator(ns, id, cfg[id] || {});
    } else {
      _.each(cfg, function (cfg, id) {
        iterator(ns, id, cfg || {});
      });
    }
  });
};
