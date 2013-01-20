"use strict";


/**
 *  server
 **/


// stdlib
var path = require('path');
var http = require('http');


// 3rd-party
var send = require('send');


////////////////////////////////////////////////////////////////////////////////


module.exports = function (N, apiPath) {
  var root    = path.join(N.runtime.mainApp.root, 'public/root');
  var logger  = N.logger.getLogger('server.static');

  //
  // Validate input parameters
  //

  N.validate(apiPath, {
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
  return function (env, callback) {
    var req, res;

    if (!env.origin.http) {
      callback(N.io.BAD_REQUEST);
      return;
    }

    req = env.origin.http.req;
    res = env.origin.http.res;

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
  };
};
