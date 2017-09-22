// Show "under maintenance" message if server in offline mode
//
'use strict';


module.exports = function (N) {

  // Allow admin panel in offline mode
  N.wire.skip('server:admin.*', 'offline_mode_check');
  // Allow login in offline mode
  N.wire.skip('server:users.auth.login.*', 'offline_mode_check');


  N.wire.before('server:*', { priority: -90 }, async function offline_mode_check(env) {
    let general_offline_mode = await env.extras.settings.fetch('general_offline_mode');

    if (general_offline_mode) {

      let admin_group_id = await N.models.users.UserGroup.findIdByName('administrators');

      // Check if user in `administrators` group
      if (env.user_info.usergroups.find(g_id => String(g_id) === String(admin_group_id))) {
        // Allow access, but show message about offline mode
        env.res.offline_mode = true;
        return;
      }

      // 503 Service Unavailable
      throw {
        code:    503,
        message: env.t('@common.server_under_maintenance')
      };
    }
  });
};
