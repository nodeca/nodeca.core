// Single-document collection storing global settings.
//


'use strict';


var _         = require('lodash');
var fs        = require('fs');
var path      = require('path');
var streamifier = require('streamifier');
var mimoza    = require('mimoza');

var Mongoose  = require('mongoose');
var grid      = require('gridfs-stream');
var ObjectId  = Mongoose.Schema.Types.ObjectId;

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
  if (_.isString(src)) {
    // file name passed
    return fs.createReadStream(src);
  } else if (src instanceof Buffer) {
    // buffer passed
    return streamifier(src);
  } else if (src.Readable) {
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
   *     owner      (optional)
   *     width      (optional)
   *     height     (optional)
   *     exif       (optional)
   */

  // TODO: (?) add collections root to constructor params
  // (fs by default)
  //
  var File = function () {};

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
    if (_.isArray(all)) {
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

          _.forEach(files, function(file) {
            gfs.remove({ _id: file._id }, function () {}); // don't wait
          });
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
   * - name (ObjectId|String) - `_id` of root file or `filename` for preview
   * - all (Boolean) - true: delete all related files too
   */
  File.put = File.prototype.put = function (src, opt, callback) {
    var input = getStream(src);

    var options = _.extend({}, opt()); // protect opt from modifications

    if (!input) { return callback(new Error('File.put: unknown source data')); }

    var _id = options._id || new ObjectId();
    _id = _id.toHexString ? _id : tryParseObjectId(_id);

    if (!_id) { return callback(new Error('File.put: invalid _id passed')); }

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

    var output = gfs.createWriteStream(options);

    output.once('finish', callback);
    input.pipe(output);
  };


  /*
   * Get GridFS file as buffer, by file (id|name)
   * For testing. Using streams is prefered.
   */
  File.get = File.prototype.get = function (name, callback) {
    var id = name.toHexString ? name : tryParseObjectId(name);

    gfs.get(id || name, callback);
  };

  /*
   * Get GridFS file as stream, by file (id|name)
   */
  File.getStream = File.prototype.getStream = function (name) {
    var id = name.toHexString ? name : tryParseObjectId(name);
    var options = id ? { _id: id } : { filename: name };

    return gfs.createReadStream(options);
  };


  N.wire.on('init:models', function emit_init_File(__, callback) {
    // reuse mongoose connection
    var mongoose = N.runtime.mongoose;
    gfs = grid(mongoose.connection, mongoose.mongo);

    N.wire.emit('init:models.' + collectionName, File, callback);
  });


  N.wire.on('init:models.' + collectionName, function init_model_File() {
    N.models[collectionName] = File;
  });
};
