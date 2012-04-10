"use strict";


/*global nodeca*/


// nodeca
var NLib = require('nlib');


// 3rd-party
var _ = NLib.Vendor.Underscore;
var Async = NLib.Vendor.Async;


// dummy function that interrupts execution after all before filters
var skipper = function (params, next) {
  next({allowed: true});
};


function process_menu(env, tasks, map, cfg) {
  _.each(cfg, function (opts, key) {
      map[key] = {allowed: !opts.check_permissions};

      if (opts.to && opts.check_permissions) {
        tasks.push(function (next) {
          nodeca.filters.run(opts.to, opts.params || {}, skipper, function (err) {
            if (undefined === err.allowed && undefined === err.denied) {
              // generic error occured.
              nodeca.logger.error(
                "Failed to run permission test: " +
                (err.message || err),
                opts
              );
            }

            map[key].allowed = err.allowed && !err.denied;
            next();
          }, _.clone(env));
        });
      }

      if (opts.submenu) {
        map[key].submenu = {};
        process_menu(tasks, map[key].submenu, opts.submenu);
      }
  });
}


module.exports.get_menu_permissions = function (menu_ids, env, callback) {
  var map = {}, tasks = [];

  // fill in tasks with workers
  nodeca.shared.common.each_menu(menu_ids, function (ns, id, cfg) {
    map[ns] = map[ns] || {};  // make sure map[ns] is an object
    map[ns][id] = {};         // prepare object for menu_id

    process_menu(env, tasks, map[ns][id], cfg);
  });

  // run permission test
  Async.parallel(tasks, function (err) {
    callback(null, map);
  });
};
