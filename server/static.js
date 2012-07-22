"use strict";


/**
 *  server
 **/


/*global nodeca, _*/


// stdlib
var path = require('path');


// 3rd-party
var connect = require('connect');


// internal
var logger = nodeca.logger.getLogger('assets');


////////////////////////////////////////////////////////////////////////////////


var static_options = {
  root: path.join(nodeca.runtime.apps[0].root, 'public/root')
};


////////////////////////////////////////////////////////////////////////////////


/**
 *  server.static(params, callback) -> Void
 *
 *  - **HTTP only**
 *
 *  Middleware that serves static assets from `public/root` directory under the
 *  main application root path.
 **/
module.exports = function (params, callback) {
  var http = this.origin.http;

  if (!http) {
    callback("HTTP requests only");
    return;
  }

  static_options.path    = params.file;
  static_options.getOnly = true;

  logger.info('(' + http.req.url + ') Serving...');

  connect.static.send(http.req, http.res, function (err) {
    var prefix = '(' + http.req.url + ') ';

    if (err) {
      logger.error(prefix + (err.message || err) + (err.stack ? ('\n' + err.stack) : ''));
      callback(prefix + (err.message || err));
      return;
    }

    logger.warn(prefix + 'File not found');
    callback(prefix + 'File not found');
  }, static_options);
};
