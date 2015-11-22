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


  UnshortCache.statics.get = function (key, callback) {
    this.findOne({ key: key }).lean(true).exec(function (err, result) {
      if (err) {
        callback(err);
        return;
      }

      if (!result) {
        callback();
        return;
      }

      callback(null, result.value);
    });
  };


  UnshortCache.statics.set = function (key, value, callback) {
    this.update({ key: key }, { value: value }, { upsert: true }, callback);
  };


  N.wire.on('init:models', function emit_init_UnshortCache(__, callback) {
    N.wire.emit('init:models.' + collectionName, UnshortCache, callback);
  });


  N.wire.on('init:models.' + collectionName, function init_model_UnshortCache(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
