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
  server = null; // see getServer() below

  //
  // Formats and writes log event into our logger
  //

  function logAssets(level, event) {
    logger[level]('%s - "%s %s HTTP/%s" %d "%s" - %s',
                  event.remoteAddress,
                  event.method,
                  event.url,
                  event.httpVersion,
                  event.code,
                  event.headers['user-agent'],
                  event.message);
  }

  //
  // lazy-loaded server
  //

  function getServer() {
    if (!server) {
      server = new Mincer.Server(N.runtime.assets.environment,
                                 N.runtime.assets.manifest);
      server.log = logAssets;
    }

    return server;
  }

  //
  // Validate input parameters
  //

  N.validate(apiPath, {
    path: {
      type: "string",
      required: true
    }
  });

  /**
   *  server.assets(params, callback) -> Void
   *
   *  - **HTTP only**
   *
   *  Mincer assets server middleware.
   **/
  return function (params, callback) {
    if (!this.origin.http) {
      callback(N.io.BAD_REQUEST);
      return;
    }

    this.origin.http.req.url = params.path;
    getServer().handle(this.origin.http.req, this.origin.http.res);
  };
};
