'use strict';


/**
 *  server
 **/


// 3rd-party
var Mincer  = require('mincer');


////////////////////////////////////////////////////////////////////////////////


module.exports = function (N, apiPath) {
  var
  logger = N.logger.getLogger('server.assets'),
  server = new Mincer.Server(N.runtime.assets.environment,
                             N.runtime.assets.manifest);

  //
  // Formats and writes log event into our logger
  //

  server.log = function logAssets(level, event) {
    logger[level]('%s - "%s %s HTTP/%s" %d "%s" - %s',
                  event.remoteAddress,
                  event.method,
                  event.url,
                  event.httpVersion,
                  event.code,
                  event.headers['user-agent'],
                  event.message);
  };

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
  return function (env, callback) {
    if (!env.origin.http) {
      callback(N.io.BAD_REQUEST);
      return;
    }

    env.origin.http.req.url = env.params.path;
    server.handle(env.origin.http.req, env.origin.http.res);
  };
};
