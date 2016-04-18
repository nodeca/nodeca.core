// Start and stop tracker for rpc cache
//
'use strict';

N.wire.once('init:parser', function rpc_cache_init() {
  N.parse.addPlugin(
    'rpc_cache_init',
    function (parser) {
      parser.bus.before('render', function start_tracker(data) {
        if (data.params.rpc_cache) {
          data.params.rpc_cache.trackStart();
        }
      });

      parser.bus.after('render', function stop_tracker(data) {
        if (data.params.rpc_cache) {
          data.params.rpc_cache.trackStop();
        }
      });
    },
    true
  );
});
