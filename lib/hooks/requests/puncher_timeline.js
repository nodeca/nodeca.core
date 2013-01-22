// Inject timeline generator
//

"use strict";


module.exports = function (N) {

  // Mark start of the request
  //
  N.wire.before('server:**', { weight: -90 }, function start_puncher(env, callback) {
    env.extras.puncher.start('Total', {
      'transport': env.request.origin,
      'request params': env.params
    });
    callback();
  });


  // Embed puncher timeline results
  //
  N.wire.after('server:**', { priority: 90 }, function finish_puncher(env, callback) {
    if (!env.extras.puncher.stop().stopped) {
      callback(new Error("Some of puncher scopes were not closed"));
      return;
    }

    env.response.data.widgets.puncher_stats = env.extras.puncher.result;

    if (env.origin.http && env.response && env.response.body) {
      // inject puncher stats
      env.response.body = env.response.body.replace('<!--{{PUNCHER_STATS}}-->',
        env.helpers.render('common.widgets.debug_timeline', env.response.data));
    }

    callback();
  });

};