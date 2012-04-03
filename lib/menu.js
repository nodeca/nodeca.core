"use strict";


// nodeca
var NLib = require('nlib');


// 3rd-party
var _ = NLib.Vendor.Underscore;


module.exports.get_menu_permissions = function (menu_ids, callback) {
  var map = {};

  _.each(menu_ids, function (id) {
    // stub empty map
    map[id] = {};
  });

  callback(null, map);
};
