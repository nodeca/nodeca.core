// Stop link cache build
//

'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, function* expand_links_cache_stop() {
    yield N.queue.worker('expand_links_cache').cancel();
  });
};
