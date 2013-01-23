// Starts redback connection, store as `N.runtime.redback`
//

"use strict";


var Redback = require('redback');


module.exports = function (N) {

  // Run after redis, in sync mode
  N.wire.before("init:models", { priority: -9 }, function redback_init(N) {
    N.runtime.redback = Redback.use(N.runtime.redis);
  });
};
