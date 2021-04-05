// File store for temporary (or frequently modified) files.
// Needed to optimize defragmentation.
//
// DB settings should be in:
//
// - N.config.database.mongo_files_tmp  (if you need separate db)
// - N.config.database.mongo            (fallback to main db)
//
// Web server located in autoload/hooks/server_bin/gridfs_tmp.js
//

'use strict';


const _         = require('lodash');
const fs        = require('fs');
const mime      = require('mime-types').lookup;

const stream    = require('stream');
const mongoose  = require('mongoose');
const pipeline  = require('util').promisify(stream.pipeline);
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

  if (typeof src === 'string') {
    // file name passed
    return fs.createReadStream(src);

  } else if (Buffer.isBuffer(src)) {
    // buffer passed
    return stream.Readable.from([ src ], { objectMode: false });

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
  File.getInfo = File.prototype.getInfo = function (name) {
    let id = name.toHexString ? name : tryParseObjectId(name);
    let condition = id ? { _id: id } : { filename: name };

    return gfs.find(condition).next();
  };

  /*
   * Remove file + all previews if exist
   *
   * Params:
   *
   * - name (ObjectId|String) - `_id` of root file or `filename` for preview
   * - all (Boolean) - true: delete all related files too
   */
  File.remove = File.prototype.remove = async function (name, all) {
    let id = name.toHexString ? name : tryParseObjectId(name);

    // The same as above, but via promise
    if (id) {
      if (all) {
        let files = await gfs.find({ filename: new RegExp('^' + escapeRegexp(String(name))) }).toArray();

        for (let file of files) await gfs.delete(file._id);
        return;
      }

      let file = await gfs.find({ _id: id }).next();
      if (file) await gfs.delete(id);
      return;
    }

    let file = await gfs.find({ filename: name }).next();
    if (file) await gfs.delete(file._id);
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
    let options = _.omit(opt, '_id', 'filename');

    let _id = opt._id || new ObjectId(null);
    if (_id.toHexString) _id = tryParseObjectId(_id);

    if (!_id) throw new Error('File.put: invalid _id passed');

    // if filename NOT set - that's original file (in other case that's thumbnail)
    let filename = opt.filename || _id.toHexString();

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

    return gfs.openUploadStreamWithId(_id, filename, options);
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
  File.put = File.prototype.put = async function (src, opt) {
    let input = getStream(src);

    if (!input) throw new Error('File.put: unknown source data');

    let output = File.createWriteStream(opt);

    // workaround for https://github.com/Automattic/mongoose/issues/10107
    // TODO: remove this when mongodb@3.6.6 gets released
    output.once('finish', () => output.destroy());

    await pipeline(input, output);

    return output.id;
  };


  /*
   * Get GridFS file as stream, by file (id|name)
   */

  // FIXME: replace with native stream and add seek support
  // https://gist.github.com/psi-4ward/7099001
  //
  File.createReadStream = File.prototype.createReadStream = function (name) {
    let id = name.toHexString ? name : tryParseObjectId(name);

    return id ?
           gfs.openDownloadStream(id) :
           gfs.openDownloadStreamByName(name);
  };


  N.wire.on('init:models', function emit_init_File(__, callback) {

    // connect to database
    let options = {
      poolSize: 10,
      connectTimeoutMS: 30000,
      keepAlive: 1,

      // fix deprecation warnings appearing in mongodb driver,
      // see https://mongoosejs.com/docs/deprecations.html for details
      useNewUrlParser: true,
      useFindAndModify: false,
      useCreateIndex: true,
      useUnifiedTopology: true
    };

    let mongoPath = N.config.database.mongo_files_tmp || N.config.database.mongo;

    let conn = mongoose.createConnection(mongoPath, options);

    conn.once('open', function () {
      gfs = new mongoose.mongo.GridFSBucket(conn.db);
      N.wire.emit('init:models.' + collectionName, File, callback);
    });
  });


  N.wire.on('init:models.' + collectionName, function init_model_File() {
    N.models[collectionName] = File;
  });
};
