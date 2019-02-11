// Start link cache build
//

'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, async function expand_links_cache_start() {
    await N.models.core.UrlTracker.updateMany(
      { status: N.models.core.UrlTracker.statuses.ERROR_RETRY },
      { $set: { status: N.models.core.UrlTracker.statuses.PENDING } }
    );

    await N.queue.expand_links_cache().run();
  });
};
