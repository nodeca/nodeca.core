// Single-document collection storing global settings.
//


'use strict';


const _         = require('lodash');
const fs        = require('fs');
const mime      = require('mime-types').lookup;

const stream    = require('readable-stream');
const mongoose  = require('mongoose');
const grid      = require('gridfs-stream');
const pump      = require('pump');
const ObjectId  = mongoose.Types.ObjectId;

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

  } else if (Buffer.isBuffer(src)) {
    // buffer passed
    let streamBuffer = new stream.Transform();
    streamBuffer.push(src);
    streamBuffer.end();
    return streamBuffer;

  } else if (src.readable) {
    return src;
  }

  return false;
}


module.exports = function (N, collectionName) {

  let gfs;

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
    let id = name.toHexString ? name : tryParseObjectId(name);
    let condition = id ? { _id: id } : { filename: name };

    // Promise if callback not passed
    return gfs.files.findOne(condition, callback);
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

    let id = name.toHexString ? name : tryParseObjectId(name);

    if (callback) {
      // remove by `_id`
      if (id) {
        // if `all` flag is set - find files by `filename` pattern and remove all
        if (all) {
          gfs.files.find({ filename: new RegExp('^' + escapeRegexp(String(name))) }).toArray(function (err, files) {
            if (err) {
              callback(err);
              return null;
            }

            gfs.remove({ filename: _.map(files, 'filename') }, callback);
          });
        } else {
          gfs.remove({ _id: id }, callback);
        }
      } else {
        // remove by `filename`
        gfs.remove({ filename: name }, callback);
      }
      return null;
    }

    // The same as above, but via promise
    if (id) {
      if (all) {
        return gfs.files.find({ filename: new RegExp('^' + escapeRegexp(String(name))) }).toArray()
                  .then(function (files) {
                    return gfs.remove({ filename: _.map(files, 'filename') });
                  });
      }
      return gfs.remove({ _id: id });
    }
    return gfs.remove({ filename: name });
  };


  /*
   * put file into gridfs
   *
   * Params:
   *
   * - opt (Object) - see schema for details. General:
   *   - _id (ObjectId|String), optional - _id to store in db
   *   - filename, optional - file name to store in db, `_id` if not set.
   *     For example '535860e62490c07f0c2eabe3_xxl' for thumbnail of
   *     '535860e62490c07f0c2eabe3' image.
   *   - contentType
   *   - metadata (Object), optional - file metadata
   *     - origName (String) - original file name (used in downloads)
   */
  File.createWriteStream = File.prototype.createWriteStream = function (opt) {
    let options = _.assign({}, opt); // protect opt from modifications

    let _id = options._id || new ObjectId(null);
    if (_id.toHexString) _id = tryParseObjectId(_id);

    if (!_id) throw new Error('File.put: invalid _id passed');

    options._id = _id;

    // if filename NOT set - that's original file (in other case that's thumbnail)
    options.filename = options.filename || options._id.toHexString();

    // if no contentType - try to guess from original file name
    if (!options.contentType) {
      let origName = (options.metadata || {}).origName;

      if (!origName) {
        throw new Error('File.put: ContentType or metadata.origName must be set');
      }

      options.contentType = mime(origName);
      if (!options.contentType) {
        throw new Error(`File.put: can't guess ContentType for ${origName}`);
      }
    }

    // This 2 lines required to properly set `contentType` field
    options.content_type = options.contentType;
    options.mode = 'w';

    return gfs.createWriteStream(options);
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
    let input = getStream(src);
    let output;

    try {
      if (!input) throw new Error('File.put: unknown source data');

      output = File.createWriteStream(opt);
    } catch (err) {
      if (callback) {
        callback(err);
        return null;
      }
      return Promise.reject(err);
    }

    let info;

    output.on('close', i => { info = i; });

    // Do cb call or return promise, depending on signature
    if (callback) {
      pump(input, output, err => callback(err, info));
      return null;
    }

    return new Promise(function (resolve, reject) {
      pump(input, output, err => {
        if (err) reject (err);
        else resolve(info);
      });
    });
  };


  /*
   * Get GridFS file as stream, by file (id|name)
   */

  // FIXME: replace with native stream and add seek support
  // https://gist.github.com/psi-4ward/7099001
  //
  File.createReadStream = File.prototype.createReadStream = function (name) {
    let id = name.toHexString ? name : tryParseObjectId(name);
    let options = id ? { _id: id } : { filename: name };

    return gfs.createReadStream(options);
  };

  // old alias
  File.getStream = File.prototype.getStream = File.createReadStream;


  N.wire.on('init:models', function emit_init_File(__, callback) {

    // connect to database
    let options = {
      server: {
        socketOptions: { keepAlive: 1 }
      },
      replset: {
        socketOptions: { keepAlive: 1 }
      }
    };

    let conn = mongoose.createConnection(N.config.database.mongo, options);

    conn.once('open', function () {
      gfs = grid(conn.db, mongoose.mongo);
      N.wire.emit('init:models.' + collectionName, File, callback);
    });
  });


  N.wire.on('init:models.' + collectionName, function init_model_File() {
    N.models[collectionName] = File;
  });
};
