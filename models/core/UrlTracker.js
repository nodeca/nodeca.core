// Keep track of all urls used in posts/messages/etc.,
// needed in case we add a new rule for embedza and want to re-fill all caches
//

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

  let UrlTracker = new Schema({
    url:     String,

    // random number from 0-1, used to split urls into chunks without using
    // expensive count() requests
    rand:    Number,

    // status (see above)
    status:  Number,

    // text of the error message (if any)
    error:   String,

    // http status (e.g. 403) or system code (e.g. 'ETIMEDOUT')
    error_code: Schema.Types.Mixed,

    // true if url-unshort expanded this url
    uses_unshort: Boolean,

    // true if embedza was spinned up and returned a snippet
    uses_embedza: Boolean
  }, {
    versionKey: false
  });


  // Indexes
  //////////////////////////////////////////////////////////////////////////////

  // used to avoid writing same url to the collection;
  // note: it *MUST* be hashed, otherwise it'll trigger "key too large to index" error
  UrlTracker.index({ url: 'hashed' });

  // used to fetch url chunks
  UrlTracker.index({ rand: 1 });

  // used to retry errored urls (change ERROR status with PENDING)
  UrlTracker.index({ status: 1 });


  // Export statuses
  //
  UrlTracker.statics.statuses = statuses;


  N.wire.on('init:models', function emit_init_UrlTracker() {
    return N.wire.emit('init:models.' + collectionName, UrlTracker);
  });


  N.wire.on('init:models.' + collectionName, function init_model_UrlTracker(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
