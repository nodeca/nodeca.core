// Stop image meta fetch
//

'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, async function image_sizes_fetch_stop() {
    await N.queue.cancel('image_sizes_fetch');
  });
};
