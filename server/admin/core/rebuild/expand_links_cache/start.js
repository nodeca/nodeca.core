// Start link cache build
//

'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, function expand_links_cache_start(env, callback) {
    N.queue.push('expand_links_cache', callback);
  });
};
