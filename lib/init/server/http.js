"use strict";


/*global nodeca, _*/


// stdlib
var url = require('url');


// 3rd-party
var qs = require('qs');


// internal
var env = require('../../env');
var handle_http = require('./http/handle_http');
var handle_rpc  = require('./http/handle_rpc');
var handle_invalid_host = require('./http/handle_invalid_host');


////////////////////////////////////////////////////////////////////////////////


// RegExp used to replace 0.0.0.0 and 127.*.*.* in hostname with `localhost`
var LOCAL_IP_RE = /^(?:127|0)(?:\.\d{1,3}){3}(:\d+)?$/;


// Attach HTTP application server to the given `server`
//
module.exports.attach = function attach(server, hosts, next) {

  //
  // For each connection - update timeout & disable buffering
  //

  server.addListener("connection", function (socket) {
    socket.setTimeout(15 * 1000);
    socket.setNoDelay();
  });

  //
  // Define application runner
  //

  server.on('request', function (req, res) {
    var parsed  = url.parse(req.url),
        handle  = ('/rpc' === parsed.pathname) ? handle_rpc : handle_http,
        data    = '';

    req.query     = qs.parse(parsed.query || '');
    req.pathname  = parsed.pathname;

    if (LOCAL_IP_RE.exec(req.headers.host)) {
      req.headers.host = 'localhost' + (RegExp.$1 || '');
    }

    if (!req.headers.host || -1 === hosts.indexOf(req.headers.host)) {
      handle_invalid_host(req, res);
      return;
    }

    // start harvesting POST data
    req.on('data', function (chunk) {
      data += chunk;
    });

    // when done, merge post params and handle request
    req.on('end', function () {
      req.params = _.defaults(qs.parse(data), req.query);
      handle(req, res);
    });
  });

  //
  // HTTP server is ready
  //

  next();
};
