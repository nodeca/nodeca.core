'use strict';


var Mongoose = require('mongoose');
var Schema   = Mongoose.Schema;


module.exports = function (N, collectionName) {

  var UnshortCache = new Schema({
    key: String,
    value: Schema.Types.Mixed
  }, {
    versionKey: false
  });


  // Indexes
  //////////////////////////////////////////////////////////////////////////////

  // find value by key
  UnshortCache.index({ key: 'hashed' });


  UnshortCache.statics.get = function (key) {
    /* eslint-disable no-undefined */
    return this.findOne({ key }).lean(true)
      .then(result => (result ? result.value : undefined));
  };


  UnshortCache.statics.set = function (key, value) {
    return this.update({ key }, { value }, { upsert: true });
  };


  N.wire.on('init:models', function emit_init_UnshortCache() {
    return N.wire.emit('init:models.' + collectionName, UnshortCache);
  });


  N.wire.on('init:models.' + collectionName, function init_model_UnshortCache(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
