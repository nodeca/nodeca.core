// Single-document collection storing global settings.
//


'use strict';


var _         = require('lodash');
var fs        = require('fs');
var path      = require('path');
var mimoza    = require('mimoza');

var stream    = require('readable-stream');
var mongoose  = require('mongoose');
var grid      = require('gridfs-stream');
var ObjectId  = mongoose.Types.ObjectId;

function escapeRegexp(source) {
  return String(source).replace(/([.?*+^$[\]\\(){}|-])/g, '\\$1');
}

function tryParseObjectId(string) {
  try {
    return new ObjectId(string);
  } catch (e) {
    return false;
  }
}

// Convert `src` (filename|buffer|stream) into readable stream
//
function getStream(src) {
  var streamBuffer;

  if (_.isString(src)) {
    // file name passed
    return fs.createReadStream(src);

  } else if (Buffer.isBuffer(src)) {
    // buffer passed
    streamBuffer = new stream.Transform();
    streamBuffer.push(src);
    streamBuffer.end();
    return streamBuffer;

  } else if (src.readable) {
    return src;
  }

  return false;
}


module.exports = function (N, collectionName) {

  var gfs;

  /*
   * There are 2 type of files:
   *
   * - original files (http://mysite.com/files/0acd8213789h4e38a9e67b23)
   * - thumbnails     (http://mysite.com/files/0acd8213789h4e38a9e67b23_small)
   *
   * Original files are fetched by _id and have `filename` empty.
   * Thumbnails are fetched by `filename`, that contains from
   * 'original_id' + '_' + 'preview size'.
   *
   * That's optimal for possible migration to other KV storages. Also that
   * simplifies delete for multiple previews at once.
   *
   * See full db structures here http://docs.mongodb.org/manual/reference/gridfs/
   *
   * Schema:
   *
   *   _id
   *   length
   *   chunkSize
   *   uploadDate
   *   md5
   *
   *   filename     (optional) XXX or XXX_size
   *   contentType
   *   aliases      ???
   *   metadata:
   *     origName   (optional)
   */

  // TODO: (?) add collections root to constructor params
  // (fs by default)
  //
  function File() {}

  /*
   * Get file info from GridFS.
   *
   * Params:
   *
   * - name (String) - `_id` {32 hex} or `filename`
   */
  File.getInfo = File.prototype.getInfo = function (name, callback) {
    var id = name.toHexString ? name : tryParseObjectId(name);
    var condition = id ? { _id: id } : { filename: name };

    gfs.files.findOne(condition, callback);
  };

  /*
   * Remove file + all previews if exist
   *
   * Params:
   *
   * - name (ObjectId|String) - `_id` of root file or `filename` for preview
   * - all (Boolean) - true: delete all related files too
   */
  File.remove = File.prototype.remove = function (name, all, callback) {
    if (_.isFunction(all)) {
      callback = all;
      all = false;
    }

    var id = name.toHexString ? name : tryParseObjectId(name);

    // remove by `_id`
    if (id) {
      gfs.remove({ _id: id }, function (err) {
        if (err) { return callback(err); }

        if (!all) { return callback(); }

        // remove "nested" (thumbnails)
        var pattern = new RegExp('^' + escapeRegexp(String(name)) + '_');
        gfs.files.find({ filename: pattern }).toArray(function (err, files) {
          if (err) { return callback(err); }

          _.forEach(files, function (file) {
            gfs.remove({ _id: file._id }, function () {}); // don't wait
          });

          callback();
        });
      });
      return;
    }

    // remove by `filename`
    gfs.remove({ filename: name }, callback);
  };


  /*
   * put file into gridfs
   *
   * Params:
   *
   * - src (Mixed) - (buffer|path|stream) with file data. Required.
   * - opt (Object) - see schema for details. General:
   *   - _id (ObjectId|String), optional - _id to store in db
   *   - filename, optional - file name to store in db, `_id` if not set.
   *     For example '535860e62490c07f0c2eabe3_xxl' for thumbnail of
   *     '535860e62490c07f0c2eabe3' image.
   *   - contentType
   *   - metadata (Object), optional - file metadata
   *     - origName (String) - original file name (used in downloads)
   */
  File.put = File.prototype.put = function (src, opt, callback) {
    var input = getStream(src);

    var options = _.assign({}, opt); // protect opt from modifications

    if (!input) {
      callback(new Error('File.put: unknown source data'));
      return;
    }

    var _id = options._id || new ObjectId(null);
    _id = _id.toHexString ? _id : tryParseObjectId(_id);

    if (!_id) {
      callback(new Error('File.put: invalid _id passed'));
      return;
    }

    options._id = _id;

    // if filename NOT set - that's original file (in other case that's thumbnail)
    options.filename = options.filename || options._id.toHexString();

    // if no contentType - try to guess from original file name
    if (!options.contentType) {
      var origName = (options.metadata || {}).origName;

      if (!origName) {
        callback(new Error('File.put: ContentType or metadata.origName must be set'));
        return;
      }

      options.contentType = mimoza.getMimeType(path.extname(origName));
      if (!options.contentType) {
        callback(new Error('File.put: can\'t guess ContentType'));
        return;
      }
    }

    // This 2 lines required to properly set `contentType` field
    options.content_type = options.contentType;
    options.mode = 'w';

    var output = gfs.createWriteStream(options);

    output.once('error', callback);
    output.once('close', function (info) {
      callback(null, info);
    });

    input.pipe(output);
  };


  /*
   * Get GridFS file as stream, by file (id|name)
   */

  // FIXME: replace with native stream and add seek support
  // https://gist.github.com/psi-4ward/7099001
  //
  File.getStream = File.prototype.getStream = function (name) {
    var id = name.toHexString ? name : tryParseObjectId(name);
    var options = id ? { _id: id } : { filename: name };

    return gfs.createReadStream(options);
  };


  N.wire.on('init:models', function emit_init_File(__, callback) {

    // connect to database
    var options = {
      server  : {
        socketOptions: { keepAlive: 1 }
      },
      replset : {
        socketOptions: { keepAlive: 1 }
      }
    };

    var conn = mongoose.createConnection(N.config.database.mongo, options);

    conn.once('open', function () {
      gfs = grid(conn.db, mongoose.mongo);
      N.wire.emit('init:models.' + collectionName, File, callback);
    });
  });


  N.wire.on('init:models.' + collectionName, function init_model_File() {
    N.models[collectionName] = File;
  });
};
