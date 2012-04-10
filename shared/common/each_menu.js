"use strict";


/*global nodeca */


// FIXME: This will not work in browser - we need cross-side solution
var _ = require('nlib').Vendor.Underscore;


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
