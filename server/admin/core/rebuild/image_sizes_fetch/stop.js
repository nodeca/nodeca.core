// Stop image meta fetch
//

'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, function* image_sizes_fetch_stop() {
    yield N.queue.cancel('image_sizes_fetch');
  });
};
