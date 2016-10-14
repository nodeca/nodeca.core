// Start link cache build
//

'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, function* expand_links_cache_start() {
    yield N.queue.expand_links_cache().run();
  });
};
