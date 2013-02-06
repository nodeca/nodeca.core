"use strict";


/**
 *  server
 **/


// stdlib
var path = require('path');
var http = require('http');


// 3rd-party
var send = require('send');
var _    = require('lodash');


////////////////////////////////////////////////////////////////////////////////


module.exports = function (N, apiPath) {
  var root    = path.join(N.runtime.mainApp.root, 'public/root');
  var logger  = N.logger.getLogger('server.static');

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
      file: {
        type: "string",
        required: true
      }
    }
  });

  /**
   *  server.static(params, callback) -> Void
   *
   *  - **HTTP only**
   *
   *  Middleware that serves static assets from `public/root` directory under the
   *  main application root path.
   **/
  N.wire.on(apiPath, function (env, callback) {
    var req, res;

    req = env.origin.req;
    res = env.origin.res;

    if ('GET' !== req.method && 'HEAD' !== req.method) {
      callback(N.io.BAD_REQUEST);
      return;
    }

    send(req, env.params.file)
      .root(root)
      .on('error', function (err) {
        if (404 === err.status) {
          callback(N.io.NOT_FOUND);
          return;
        }

        callback(err);
      })
      .on('directory', function () {
        callback(N.io.BAD_REQUEST);
      })
      .on('end', function () {
        logger.info('%s - "%s %s HTTP/%s" %d "%s" - %s',
                    req.connection.remoteAddress,
                    req.method,
                    req.url,
                    req.httpVersion,
                    res.statusCode,
                    req.headers['user-agent'],
                    http.STATUS_CODES[res.statusCode]);
      })
      .pipe(res);
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
