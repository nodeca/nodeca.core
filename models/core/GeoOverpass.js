// Store results of HTTP requests to Overpass (exact match)
//

'use strict';


const Mongoose = require('mongoose');
const Schema   = Mongoose.Schema;


module.exports = function (N, collectionName) {

  let GeoOverpass = new Schema({
    // hash used for quick exact search, `lon:lat`
    hash:       String,

    location:   [ Number, Number ],

    ts:         { type: Date, 'default': Date.now },

    result:     String,

    // text of the error message (if any)
    error:      String,

    // http status (e.g. 403) or system code (e.g. 'ETIMEDOUT')
    error_code: Schema.Types.Mixed
  }, {
    versionKey: false
  });


  // Indexes
  //////////////////////////////////////////////////////////////////////////////

  GeoOverpass.index({ hash: 'hashed' });


  // Generate hash field used for search
  //
  function hash(lonlat) {
    return lonlat.join(':');
  }

  GeoOverpass.statics.hash = hash;


  N.wire.on('init:models', function emit_init_GeoOverpass(__, callback) {
    N.wire.emit('init:models.' + collectionName, GeoOverpass, callback);
  });


  N.wire.on('init:models.' + collectionName, function init_model_GeoOverpass(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
