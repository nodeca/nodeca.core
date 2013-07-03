// Create empty `menus` object to be filled-in by next hooks.


'use strict';


module.exports = function (N) {
  N.wire.after('server_chain:http:*', { priority: 70 }, function menus_init(env) {
    env.runtime.menus = {};
  });
};
