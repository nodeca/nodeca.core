// Static file handler. Serves all of the files from `public/root` directory
// under the main application root path.

'use strict';


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
  function isFresh(headers, fileInfo) {
    var etagMatches = true;
    var notModified = true;

    if (!headers['if-modified-since'] && !headers['if-none-match']) { return false; }

    var cc = headers['cache-control'];
    if (cc && cc.indexOf('no-cache') !== -1) { return false; }

    if (headers['if-none-match']) {
      var noneMatch = headers['if-none-match'].split(/ *, */);
      etagMatches = (-1 !== noneMatch.indexOf(headers.etag)) || ('*' === noneMatch[0]);
    }

    if (headers['if-modified-since']) {
      notModified = (fileInfo.uploadDate <= new Date(headers['if-modified-since']));
    }

    return etagMatches && notModified;
  }


  N.wire.on('server_bin:core.gridfs', function static_file_send(env, callback) {
    var req = env.origin.req
      , res = env.origin.res;

    if ('GET' !== req.method && 'HEAD' !== req.method) {
      callback(403);
      return;
    }

    var file = new N.runtime.models.File();

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

      // If we can finish with 304 reply - do it.
      if (isFresh(req.headers, fileInfo)) {
        env.status = 304;
        env.log_request(env);
        req.writeHead(env.status);
        req.end();
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
      req.writeHead(env.status);

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
