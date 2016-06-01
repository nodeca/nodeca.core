// Start and stop tracker for rpc cache
//
'use strict';

N.wire.once('init:parser', function rpc_cache_init() {
  N.parser.addPlugin(
    'rpc_cache_init',
    function (parser) {
      parser.bus.before('ast2html', function start_tracker(data) {
        if (data.params.rpc_cache) {
          data.params.rpc_cache.trackStart();
        }
      });

      parser.bus.after('ast2html', function stop_tracker(data) {
        if (data.params.rpc_cache) {
          data.params.rpc_cache.trackStop();
        }
      });
    },
    true
  );
});
