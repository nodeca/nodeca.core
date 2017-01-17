// File store for temporary (or frequently modified) files.
// Needed to optimize defragmentation. Unlike main File store, image
// thumbnail names are not supported here (not needed)
//
// DB settings shouls be in:
//
// - N.config.database.mongo_files_tmp  (if you need separate db)
// - N.config.database.mongo            (fallback to main db)
//
// Web server located in autoload/hooks/server_bin/gridfs_tmp.js
//

'use strict';


const fs        = require('fs');
const mime      = require('mime-types').lookup;

const stream    = require('readable-stream');
const Promise   = require('bluebird');
const mongoose  = require('mongoose');
const grid      = require('gridfs-stream');
const pump      = require('pump');
const ObjectId  = mongoose.Types.ObjectId;


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

  if (typeof src === 'string') {
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
   *   filename     (optional)
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
  File.getInfo = File.prototype.getInfo = function (name) {
    let id = name.toHexString ? name : tryParseObjectId(name);
    let condition = id ? { _id: id } : { filename: name };

    return gfs.files.findOne(condition).then(result => result);
  };

  /*
   * Remove file + all previews if exist
   *
   * Params:
   *
   * - name (ObjectId|String) - `_id` of root file or `filename` for preview
   */
  File.remove = File.prototype.remove = Promise.coroutine(function* (name) {
    let id = name.toHexString ? name : tryParseObjectId(name);

    // The same as above, but via promise
    if (id) {
      return yield gfs.remove({ _id: id }).then(result => result);
    }
    return yield gfs.remove({ filename: name }).then(result => result);
  });


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
    let options = Object.assign({}, opt); // protect opt from modifications

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
  File.put = File.prototype.put = Promise.coroutine(function* (src, opt) {
    let input = getStream(src);

    if (!input) throw new Error('File.put: unknown source data');

    let output = File.createWriteStream(opt);
    let info;

    output.on('close', i => { info = i; });

    yield Promise.fromCallback(cb => pump(input, output, cb));
    return info;
  });


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


  N.wire.on('init:models', function emit_init_File(__, callback) {

    // connect to database
    let options = {
      promiseLibrary: Promise,
      server: {
        poolSize: 50,
        socketOptions: {
          connectTimeoutMS: 30000,
          keepAlive: 1
        }
      },
      replset: {
        poolSize: 50,
        socketOptions: {
          connectTimeoutMS: 30000,
          keepAlive: 1
        }
      }
    };

    let mongoPath = N.config.database.mongo_files_tmp || N.config.database.mongo;

    let conn = mongoose.createConnection(mongoPath, options);

    conn.once('open', function () {
      gfs = grid(conn.db, mongoose.mongo);
      N.wire.emit('init:models.' + collectionName, File, callback);
    });
  });


  N.wire.on('init:models.' + collectionName, function init_model_File() {
    N.models[collectionName] = File;
  });
};
