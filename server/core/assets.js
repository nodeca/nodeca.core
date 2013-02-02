'use strict';


module.exports = function (N, apiPath) {
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
    if (!env.origin.http) {
      callback(N.io.BAD_REQUEST);
      return;
    }

    // keep original url for log
    env.origin.http.req.originalUrl = env.origin.http.req.url;
    // rewrite url for mincer server
    env.origin.http.req.url         = env.params.path;

    N.runtime.assets.server.handle(env.origin.http.req, env.origin.http.res);
  });

  // Exclude unused midlewares. Only `before` filter are actial,
  // since `on` handler terminates futher processing.
  //
  N.wire.skip(apiPath, [
    'cookies_start',
    'session_start',
    'puncher_start',
    'csrf_protect',
    'locale_inject',
    ]
  );

};
