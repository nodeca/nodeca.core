'use strict';


var _ = require('lodash');


module.exports = function (N, apiPath) {

  // Handle http requests only
  apiPath = apiPath.slice(0,-1) + 'http';

  //
  // Validate input parameters
  //

  N.validate(apiPath, {
    // DON'T validate unknown params - those can sexists,
    // if someone requests '/myfile.txt?xxxx' instead of '/myfile.txt/
    additionalProperties: true,
    properties: {
      path: {
        type: "string",
        required: true
      }
    }
  });

  /**
   *  server.assets(params, callback) -> Void
   *
   *  - **HTTP only**
   *
   *  Mincer assets server middleware.
   **/
  N.wire.on(apiPath, function (env, callback) {
    // Dummy code, to cheat jshint
    callback = function () {};

    // keep original url for log
    env.origin.req.originalUrl = env.origin.req.url;
    // rewrite url for mincer server
    env.origin.req.url         = env.params.path;

    N.runtime.assets.server.handle(env.origin.req, env.origin.res);
  });

  // Exclude unused midlewares (only `before` filter are actial
  // since `on` handler terminates futher processing)
  //
  // Real handler has priority = 0, everything else is garbage
  //
  _.each(N.wire.getHandlers(apiPath), function (handler) {
    if (0 !== handler.priority) {
      N.wire.skip(apiPath, handler.name);
    }
  });
};
