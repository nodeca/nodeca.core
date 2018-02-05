'use strict';


const Mongoose = require('mongoose');
const Schema   = Mongoose.Schema;


module.exports = function (N, collectionName) {

  let statuses = {
    PENDING:     1,
    SUCCESS:     2,
    ERROR_RETRY: 3, // errors that we can recover from by retrying (TIMEOUT, etc.)
    ERROR_FATAL: 4  // errors that we can't recover from (401, 403, 404)
  };

  let ImageSizeCache = new Schema({
    url:        String,

    // status (see above)
    status:     Number,

    // total amount of requests initiated to fetch this image
    // (initial request + retries)
    retries:    Number,

    // text of the error message (if any)
    error:      String,

    // http status (e.g. 403) or system code (e.g. 'ETIMEDOUT')
    error_code: Schema.Types.Mixed,

    // probe results (only if status=SUCCESS)
    value: {
      width:    Number, // width factor
      height:   Number, // height factor
      wUnits:   String, // width unit (`px`, `em`, etc.)
      hUnits:   String, // height unit (`px`, `em`, etc.)
      length:   Number  // file size in bytes
    },

    // timestamps of start and end of last request, for debugging
    ts_begin:   Date,
    ts_end:     Date
  }, {
    versionKey: false
  });


  // Indexes
  //////////////////////////////////////////////////////////////////////////////

  // used to avoid writing same url to the collection;
  // note: it *MUST* be hashed, otherwise it'll trigger "key too large to index" error
  ImageSizeCache.index({ url: 'hashed' });

  // - get urls by status
  // - retry errored urls (change ERROR status with PENDING)
  ImageSizeCache.index({ status: 1 });


  // Export statuses
  //
  ImageSizeCache.statics.statuses = statuses;


  N.wire.on('init:models', function emit_init_ImageSizeCache(__, callback) {
    N.wire.emit('init:models.' + collectionName, ImageSizeCache, callback);
  });


  N.wire.on('init:models.' + collectionName, function init_model_ImageSizeCache(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
