'use strict';


var Mongoose = require('mongoose');
var Schema   = Mongoose.Schema;


module.exports = function (N, collectionName) {

  var statuses = {
    PENDING:  1,
    SUCCESS:  2,
    ERROR:    3
  };

  var ExpandUrl = new Schema({
    //
    // Filled when links are written to this collection
    //

    url:     String,

    // is it autolink or not? (don't run embedza for regular links)
    is_auto: Boolean,

    // random number from 0-1, used to split urls into chunks without using
    // expensive count() requests
    rand:    Number,

    //
    // Filled when link contents are fetched from remote server
    //

    // status (see above)
    status:  Number,

    // text of the error message (if any)
    error:   String,

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
  ExpandUrl.index({ url: 'hashed' });

  // used to fetch url chunks
  ExpandUrl.index({ rand: 1 });


  // Export statuses
  //
  ExpandUrl.statics.statuses = statuses;


  N.wire.on('init:models', function emit_init_ExpandUrl(__, callback) {
    N.wire.emit('init:models.' + collectionName, ExpandUrl, callback);
  });


  N.wire.on('init:models.' + collectionName, function init_model_ExpandUrl(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
