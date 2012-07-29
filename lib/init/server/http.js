"use strict";


/*global nodeca, _*/


// stdlib
var url = require('url');


// 3rd-party
var qs = require('qs');


// internal
var env = require('../../env');
var compression = require('./http/compression');
var handle_http = require('./http/handle_http');
var handle_rpc  = require('./http/handle_rpc');


////////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////////


// Attach HTTP application server to the given `server`
//
module.exports.attach = function attach(server, next) {

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
    var url = url.parse(req.url);

    req.query     = qs.parse(req.query || '');
    req.pathname  = url.pathname;

    ('/rpc' === url.pathname ? handle_rpc : handle_http)(req, res);
  });

  //
  // HTTP server is ready
  //

  next();

};
