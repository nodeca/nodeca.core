// Static file handler. Serves all of the files from `public/root` directory
// under the main application root path.

'use strict';


const fresh = require('fresh');


module.exports = function (N) {

  N.validate('server_bin:core.gridfs', {
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


  N.wire.on('server_bin:core.gridfs', function static_file_pre_send(env, callback) {

    if ([ 'GET', 'HEAD' ].indexOf(env.origin.req.method) === -1) {
      callback(403);
      return;
    }

    N.models.core.File.getInfo(env.params.bucket, (err, fileInfo) => {
      if (err) {
        callback(500);
        return;
      }

      if (!fileInfo) {
        callback(404);
        return;
      }

      env.data.fileInfo = fileInfo;
      callback();
    });
  });


  N.wire.on('server_bin:core.gridfs', function static_file_send(env) {
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
    // 7 days is ok. If we decide to rebuild thumbnails, those will be
    // refreshed with reasonable delay.
    res.setHeader('Cache-Control',  'max-age=604800');

    //
    // If metadata has original name, add content-disposition header.
    // Note, that images with this header can not be opened in browser
    // by direct link - download will be started. However, images in html
    // are ok.
    //
    // On practice, we should store original names only for binary attachments.
    //

    let name = (fileInfo.metadata || {}).origName;
    if (name) {
      // Some Content-Disposition magic
      // http://stackoverflow.com/questions/93551/
      let contentDisposition;
      if (/^[\x20-\x36\x38\x40\x41\x43-\x7F]*$/.test(name)) {
        // ascii chars without *,',%
        contentDisposition = 'attachment; filename=' + name;
      } else {
        // Don't care about old browsers
        // XXX: use `ua-parser` module to add alternatives
        contentDisposition = 'attachment; filename*=UTF-8\'\'' + encodeURIComponent(name);
      }
      res.setHeader('Content-Disposition', contentDisposition);
    }

    // If we can finish with 304 reply - do it.
    if (fresh(req.headers, res._headers)) {
      env.status = 304;
      env.log_request(env);
      res.statusCode = env.status;
      res.end();
      return;
    }

    // Set content type and length headers
    res.setHeader('Content-Type', fileInfo.contentType);
    res.setHeader('Content-Length', fileInfo.length);

    //
    // Begin output
    //

    env.status = 200;
    // XXX: that will cause improper size logging on connection termination
    env.log_request(env);
    res.statusCode = env.status;

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    let stream = N.models.core.File.getStream(env.params.bucket);

    stream.on('error', err => {
      N.logger.error(`Error while streaming ${env.params.bucket} from gridfs: ${err.message}`);
      res.end();
    });

    stream.pipe(res);
  });
};
