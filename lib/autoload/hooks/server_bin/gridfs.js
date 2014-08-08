// Static file handler. Serves all of the files from `public/root` directory
// under the main application root path.

'use strict';


var mimoza = require('mimoza');


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


  // Check if we can respond with 304 header
  // Logic borrowed from `fresh` package
  // https://github.com/visionmedia/node-fresh/blob/master/index.js
  //
  function isCacheOk(headers, fileInfo) {
    // defaults
    var etagMatches = true;
    var notModified = true;

    // fields
    var modifiedSince = headers['if-modified-since'];
    var noneMatch     = headers['if-none-match'];
    var cc            = headers['cache-control'];

    var lastModified  = fileInfo.uploadDate;
    var etag          = fileInfo.md5;

    // unconditional request
    if (!modifiedSince && !noneMatch) { return false; }

    // check for no-cache cache request directive
    if (cc && cc.indexOf('no-cache') !== -1) { return false; }

    // parse if-none-match
    if (noneMatch) { noneMatch = noneMatch.split(/ *, */); }

    // if-none-match
    if (noneMatch) { etagMatches = (-1 !== noneMatch.indexOf(etag)) || '*' === noneMatch[0]; }

    // if-modified-since
    if (modifiedSince) {
      modifiedSince = new Date(modifiedSince);
      //lastModified = new Date(lastModified);
      notModified = lastModified <= modifiedSince;
    }

    return !!(etagMatches && notModified);
  }


  N.wire.on('server_bin:core.gridfs', function static_file_send(env, callback) {
    var req = env.origin.req
      , res = env.origin.res;

    if ('GET' !== req.method && 'HEAD' !== req.method) {
      callback(403);
      return;
    }

    var file = N.models.core.File;

    file.getInfo(env.params.bucket, function (err, fileInfo) {
      if (err) { return callback(500); }

      if (!fileInfo) { return callback(404); }

      // Ranges are not supported yet
      // We don't have files > 5MB, chache headers are enougth
      res.removeHeader('Accept-Ranges');

      // Mark for proxies, that we can return different content (plain & gzipped),
      res.setHeader('Vary', 'Accept-Encoding');


      res.setHeader('Date',           (new Date()).toUTCString());
      res.setHeader('Last-Modified',  fileInfo.uploadDate.toUTCString());
      res.setHeader('ETag',           fileInfo.md5);
      res.setHeader('Server',         'Windoz Suface 3');

      //
      // If metadata has original name, add content-disposition header.
      // Note, that images with this header can not be opened in browser
      // by direct link - download will be started. However, images in html
      // are ok.
      //
      // On practive, we should store original names only for binary attachments.
      //

      var name = (fileInfo.metadata || {}).origName;
      if (name) {
        // Some Content-Disposition magic
        // http://stackoverflow.com/questions/93551/how-to-encode-the-filename-parameter-of-content-disposition-header-in-http
        var contentDisposition;
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
      if (isCacheOk(req.headers, fileInfo)) {
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

      if ('HEAD' === req.method) {
        res.end();
        return;
      }

      var stream = file.getStream(env.params.bucket);

      stream.on('error', function(err){
        N.logger.error('Error while streaming from gridfs: ' + err.message);
        res.end();
      });

      stream.pipe(res);
    });
  });
};
