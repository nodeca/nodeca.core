// gzip/deflate response
// Should stait just prior to send

'use strict';


var zlib         = require('zlib');
var compressible = require('compressible');


////////////////////////////////////////////////////////////////////////////////

function get_allowed_compression(req) {
  var accept = req.headers['accept-encoding'] || '';

  if (accept === '*' || accept.indexOf('gzip') >= 0) {
    return 'gzip';
  }

  return false;
}

function compress(algo, source, callback) {
  if (algo === 'gzip') {
    zlib.gzip(source, callback);
    return;
  }

  callback(new Error('Unsupported compression method requested'));
}


////////////////////////////////////////////////////////////////////////////////

module.exports = function (N) {

  N.wire.after([ 'responder:http', 'responder:rpc' ], { priority: 95 }, function body_compress(env, callback) {
    var type, algorythm,
        headers = env.headers,
        body = env.body;

    //
    // Check whenever compression is allowed by client or not
    //

    type = headers['Content-Type'] || env.origin.res.getHeader('Content-Type');

    // Return raw response, if compression is not allowed or body is too small
    if (!compressible(type) || Buffer.byteLength(body || '') < 500) {
      callback();
      return;
    }

    //
    // Mark for proxies, that we can return different content (plain & gzipped),
    // depending on specified (comma-separated) headers
    //

    headers.Vary = 'Accept-Encoding';
    algorythm = get_allowed_compression(env.origin.req);

    //
    // Return raw response, if client does not support compression method
    //

    if (!algorythm) {
      callback();
      return;
    }

    //
    // Compress body
    //

    compress(algorythm, body, function (err, buffer) {
      // on fuckup just leave body intact,
      // but this should never happen
      if (err) {
        callback(err);
        return;
      }

      headers['Content-Encoding'] = algorythm;
      env.body = buffer;

      callback();
      return;
    });
  });
};
