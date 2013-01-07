"use strict";


/*global N*/



// internal
var get_menu_permissions = require('../../menu').get_menu_permissions;


////////////////////////////////////////////////////////////////////////////////


// Middleware that injects menus configuration into the environment.
//
//
// ##### See Also
//
// - [[shared.menus.build]]
//
N.filters.after('', { weight: 50 }, function inject_menu(params, callback) {
  var ids = ['common', this.request.namespace],
      data = this.response.data,
      env = this;

  if (true) { // jshint workaround
    // TODO: menu injector will be removed later
    N.logger.warn('inject_menu() disabled (see: ' + __filename + ')');
    callback();
    return;
  }

  if (!this.origin.http || !this.session) {
    callback(null);
    return;
  }

  env.extras.puncher.start('Calc menu permissions');

  get_menu_permissions(ids, this, function (err, perms) {
    data.menus = N.shared.menus.build(ids, perms, N.runtime.router);
    env.extras.puncher.stop();
    callback(err);
  });
});
