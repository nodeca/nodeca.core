'use strict';


/*global nodeca, _*/


// stdlib
var zlib = require('zlib');


// nodeca
var HashTree = require('nlib').Support.HashTree;


// internals
var helpers = require('./renderer/helpers');


////////////////////////////////////////////////////////////////////////////////


function get_allowed_compression(req) {
  var accept = req.headers['accept-encoding'] || '';

  if ('*' === accept || 0 <= accept.indexOf('gzip')) {
    return 'gzip';
  }

  if (0 <= accept.indexOf('deflate')) {
    return 'deflate';
  }

  return false;
}


// small helper to run compressor
function compress(algo, source, callback, thisArg) {
  ('gzip' === algo ? zlib.gzip : zlib.deflate)(source, callback.bind(thisArg));
}


function get_layouts_stack(layout) {
  var stack = layout.split('.'), i, l;

  for (i = 1, l = stack.length; i < l; i++) {
    stack[i] = stack[i - 1] + '.' + stack[i];
  }

  return stack;
}


////////////////////////////////////////////////////////////////////////////////


module.exports = function renderer(params, callback) {
  var view,
      http      = this.origin.http,
      headers   = this.response.headers,
      render, locals, compression;

  if (!http) {
    // skip non-http requests
    callback();
    return;
  }

  //
  // Prepare variables
  //

  try {
    render = nodeca.shared.common.render.prepare(
      this.session.locale,
      this.session.theme,
      this.response.view,
      get_layouts_stack(this.response.layout)
    );
  } catch (err) {
    callback(err);
    return;
  }

  compression = get_allowed_compression(http.req);

  //
  // Mark for proxies, that we can return different content (plain & gzipped),
  // depending on specified (comma-separated) headers
  //

  headers['Vary'] = 'Accept-Encoding';

  //
  // 304 Not Modified
  //

  if (headers['ETag'] && headers['ETag'] === http.req.headers['if-none-match']) {
    // The one who sets `ETag` header must set also (by it's own):
    //  - `Last-Modified`
    //  - `Cache-Control`
    this.response.statusCode = 304;
    callback();
    return;
  }

  //
  // Set Content-Type and charset
  //

  headers['Content-Type'] = 'text/html; charset=UTF-8';

  //
  // If compression is allowed, set Content-Encoding
  //

  if (compression) {
    headers['Content-Encoding'] = compression;
  }

  //
  // HEAD requested - no need for real rendering
  //

  if ('HEAD' === http.req.method) {
    callback();
    return;
  }

  try {
    locals = _.extend(this.response.data, helpers, this.helpers);
    this.response.body = render(locals).body;
  } catch (err) {
    callback(err);
    return;
  }

  //
  // No compression (or it's useless) - continue
  //

  if (false === compression || 500 > Buffer.byteLength(this.response.body)) {
    callback();
    return;
  }

  //
  // Compress body
  //

  compress(compression, this.response.body, function (err, buffer) {
    this.response.body = buffer;
    callback(err);
  }, this);
};
