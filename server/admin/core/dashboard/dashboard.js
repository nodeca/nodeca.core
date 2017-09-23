'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});


  N.wire.on(apiPath, function dashboard(env) {
    env.res.head.title = env.t('title');
  });


  // Fill offline mod value
  //
  N.wire.after(apiPath, async function fill_offline_mode_setting(env) {
    env.res.offline_mode = await env.extras.settings.fetch('general_offline_mode');
  });
};
