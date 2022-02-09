// Asset files handler. Serves Mincer's generated asset files:
// - stylesheets
// - client-side javascripts
// - compiled view templates
// - etc

'use strict';


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
    var req = env.origin.req,
        res = env.origin.res;

    if (req.method !== 'GET' && req.method !== 'HEAD') throw N.io.BAD_REQUEST;

    try {
      const ss = send(req, env.params.path, { root, index: false, maxAge: '1y' });

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
