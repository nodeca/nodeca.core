// Store results of HTTP requests to Nominatim service
//

'use strict';


const Mongoose = require('mongoose');
const Schema   = Mongoose.Schema;


module.exports = function (N, collectionName) {

  let GeoNominatim = new Schema({
    // hash used for quick exact search, `lon:lat:locale`
    hash:       String,

    location:   [ Number, Number ],

    locale:     String,

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

  GeoNominatim.index({ hash: 'hashed' });


  // Generate hash field used for search
  //
  function hash(lonlat, locale) {
    return lonlat.join(':') + (locale ? ':' + locale : '');
  }

  GeoNominatim.statics.hash = hash;


  N.wire.on('init:models', function emit_init_GeoNominatim(__, callback) {
    N.wire.emit('init:models.' + collectionName, GeoNominatim, callback);
  });


  N.wire.on('init:models.' + collectionName, function init_model_GeoNominatim(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
