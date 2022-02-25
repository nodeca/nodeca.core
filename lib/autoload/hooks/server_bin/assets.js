// Asset files handler. Serves Mincer's generated asset files:
// - stylesheets
// - client-side javascripts
// - compiled view templates
// - etc

'use strict';


const fs           = require('fs/promises');
const path         = require('path');
const send         = require('send');
const compression  = require('util').promisify(require('compression')());
const { pipeline } = require('stream/promises');


module.exports = function (N) {
  var root = path.join(N.mainApp.root, 'assets', 'public');


  N.validate('server_bin:core.assets', {
    // DON'T validate unknown params - those can exists,
    // if someone requests '/myfile.txt?xxxx' instead of '/myfile.txt/
    additionalProperties: true,
    properties: {
      path: {
        type: 'string',
        required: true
      }
    }
  });

  // Default compression to reduce traffic between backend and nginx proxy.
  N.wire.on('server_bin:core.assets', function asset_file_send(env) {
    return compression(env.origin.req, env.origin.res);
  });

  N.wire.on('server_bin:core.assets', async function asset_file_send(env) {
    const req = env.origin.req;
    const res = env.origin.res;

    if (req.method !== 'GET' && req.method !== 'HEAD') throw N.io.BAD_REQUEST;

    let file_path = env.params.path;

    // If brotli reply allowed && not HEAD request => return pre-compressed
    // file if exists.
    if (/\bbr\b/.test(req.headers['accept-encoding'] || '')
        && req.method === 'GET') {

      let compressed_path = `${file_path}.br`;
      let brotli_exists = false;

      try {
        // throws if not exists
        await fs.access(path.join(root, compressed_path));
        brotli_exists = true;
      } catch (_) {}

      if (brotli_exists) {
        res.setHeader('Content-Encoding', 'br');
        res.setHeader('Vary', 'Accept-Encoding');

        // Override Content-Type from original file extension
        const type = send.mime.lookup(file_path);
        const charset = send.mime.charsets.lookup(type);
        res.setHeader('Content-Type', type + (charset ? '; charset=' + charset : ''));

        // Substitute file path with compressed one
        file_path = compressed_path;
      }
    }

    try {
      const ss = send(req, file_path, { root, index: false, maxAge: '1y' });

      try {
        await pipeline(ss, res);
      } catch (err) {
        // Suppress "premature close" errors (if client stops reading)
        if (err.code !== 'ERR_STREAM_PREMATURE_CLOSE') throw err;
      }
      if (res.statusCode) env.status = res.statusCode;

    } catch (err) {
      // Errors with status are not fatal,
      // rethrow those up as code, not as Error
      throw err.status || err;
    }
  });
};
