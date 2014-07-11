/**
 *  Renders and injects debug stats on successful RPC requests.
 **/


'use strict';


N.wire.on('io.complete', function debug_timeline(info) {

  // Skip if puncher stats not recieved.
  if (!info.res ||
      !info.res.puncher_stats) {
    return;
  }

  var $timeline = $('#debug_timeline');

  // Skip if there is no #debug_timeline
  if (0 === $timeline.length) {
    return;
  }

  $timeline.replaceWith(
    N.runtime.render(module.apiPath, {
      stats: info.res.puncher_stats
    })
  );
});
