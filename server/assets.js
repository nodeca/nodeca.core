'use strict';


module.exports = function (N, apiPath) {
  //
  // Validate input parameters
  //

  N.validate(apiPath, {
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
    if (!env.origin.http) {
      callback(N.io.BAD_REQUEST);
      return;
    }

    env.origin.http.req.url = env.params.path;
    N.runtime.assets.server.handle(env.origin.http.req, env.origin.http.res);
  });
};
