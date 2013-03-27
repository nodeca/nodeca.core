/**
 *  Renders and injects debug stats on successful RPC requests.
 **/


'use strict';


N.wire.on('io.success', function debug_timeline(response) {
  $('#debug_timeline').replaceWith(
    N.runtime.render(module.apiPath, {
      stats: response.data.blocks.puncher_stats
    })
  );
});
