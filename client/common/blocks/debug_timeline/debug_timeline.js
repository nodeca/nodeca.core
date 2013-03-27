/**
 *  Renders and injects debug stats on successful RPC requests.
 **/


'use strict';


N.wire.on('io.complete', function debug_timeline(info) {
  if (!info.response || !info.response.data) {
    return;
  }

  var $timeline = $('#debug_timeline');

  // Skip if there is no #debug_timeline
  if (0 === $timeline.lentgh) {
    return;
  }

  $timeline.replaceWith(
    N.runtime.render(module.apiPath, {
      stats: info.response.data.blocks.puncher_stats
    })
  );
});
