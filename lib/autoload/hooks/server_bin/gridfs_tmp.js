// Static file handler for `File` store.
// Serves all of the files from `/tfs/*` path

'use strict';


const fresh       = require('fresh');
const encode      = require('mdurl/encode');
const { pipeline } = require('stream/promises');


module.exports = function (N) {

  N.validate('server_bin:core.gridfs_tmp', {
    // DON'T validate unknown params - those can exists,
    // if someone requests '/myfile.txt?xxxx' instead of '/myfile.txt/
    additionalProperties: true,
    properties: {
      bucket: {
        type: 'string',
        required: true
      }
    }
  });


  N.wire.on('server_bin:core.gridfs_tmp', async function static_file_pre_send(env) {
    if ([ 'GET', 'HEAD' ].indexOf(env.origin.req.method) === -1) throw 403;

    env.data.fileInfo = await N.models.core.FileTmp.getInfo(env.params.bucket);

    if (!env.data.fileInfo) throw 404;
  });


  N.wire.on('server_bin:core.gridfs_tmp', async function static_file_send(env) {
    let req = env.origin.req,
        res = env.origin.res,
        fileInfo = env.data.fileInfo;

    // Ranges are not supported yet
    // We don't have files > 5MB, cache headers are enougth
    res.removeHeader('Accept-Ranges');

    // Mark for proxies, that we can return different content (plain & gzipped),
    // res.setHeader('Vary', 'Accept-Encoding');

    res.setHeader('Date',           (new Date()).toUTCString());
    res.setHeader('Last-Modified',  fileInfo.uploadDate.toUTCString());
    res.setHeader('ETag',           fileInfo.md5);
    res.setHeader('Server',         'Windoz Sufface 3');
    // That helps browser to avoid unnecessary requests with 304 responses
    // Set to 5 minutes for FileTmp (against 7 days for File)
    res.setHeader('Cache-Control',  'max-age=300');

    //
    // If metadata has original name, add content-disposition header.
    // Note, that images with this header can not be opened in browser
    // by direct link - download will be started. However, images in html
    // are ok.
    //
    // On practice, we should store original names only for binary attachments.
    //

    let name = fileInfo.metadata?.origName;

    if (name) {
      // Content-Disposition magic (RFC5987)
      // http://stackoverflow.com/questions/93551/
      // See also http://greenbytes.de/tech/tc2231/
      let encoded   = encode(name, '!#$&+-.^_`|~', false);
      let asciified = encoded.replace(/%[0-9a-f]{2}/ig, '_');

      let contentDisposition = `attachment; filename=${asciified}`;

      if (asciified !== name) {
        contentDisposition += `; filename*=UTF-8''${encoded}`;
      }
      res.setHeader('Content-Disposition', contentDisposition);
    }

    // If we can finish with 304 reply - do it.
    if (fresh(req.headers, res._headers)) {
      res.statusCode = env.status = 304;
      res.end();
      return;
    }

    // Set content type and length headers
    res.setHeader('Content-Type', fileInfo.contentType);
    res.setHeader('Content-Length', fileInfo.length);

    //
    // Begin output
    //

    res.statusCode = env.status = 200;

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    let src = N.models.core.FileTmp.createReadStream(env.params.bucket);

    try {
      await pipeline(src, res);
    } catch (err) {
      N.logger.fatal(`Error while streaming ${env.params.bucket} from gridfsTmp: ${err.message}`);
      throw err;
    }
  });
};
