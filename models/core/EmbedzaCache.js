'use strict';


var Mongoose = require('mongoose');
var Schema   = Mongoose.Schema;


module.exports = function (N, collectionName) {

  var EmbedzaCache = new Schema({
    key: String,
    value: Schema.Types.Mixed
  }, {
    versionKey: false
  });


  // Indexes
  //////////////////////////////////////////////////////////////////////////////

  // In embedza to find value by key
  EmbedzaCache.index({ key: 'hashed' });


  EmbedzaCache.statics.get = function (key, callback) {
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


  EmbedzaCache.statics.set = function (key, value, callback) {
    var record = new this({ key: key, value: value });

    record.save(callback);
  };


  N.wire.on('init:models', function emit_init_EmbedzaCache(__, callback) {
    N.wire.emit('init:models.' + collectionName, EmbedzaCache, callback);
  });


  N.wire.on('init:models.' + collectionName, function init_model_EmbedzaCache(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
