// Start image meta fetch
//

'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, async function image_sizes_fetch_start() {
    await N.queue.image_sizes_fetch().run();
  });
};
