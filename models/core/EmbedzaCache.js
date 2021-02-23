'use strict';


var Mongoose = require('mongoose');
var Schema   = Mongoose.Schema;


module.exports = function (N, collectionName) {

  var EmbedzaCache = new Schema({
    key: String,

    // JSON-stringified object, see embedza docs for details
    value: String
  }, {
    versionKey: false
  });


  // Indexes
  //////////////////////////////////////////////////////////////////////////////

  // In embedza to find value by key
  EmbedzaCache.index({ key: 'hashed' });


  EmbedzaCache.statics.get = function (key) {
    // Get image dimensions cache from redis instead of mongodb
    if (key.indexOf('image#') === 0) {
      return N.redis.get('embedza:' + key).then(cache => {
        if (cache) {
          try {
            cache = JSON.parse(cache);
          } catch (__) {
            cache = null;
          }
        }

        return cache;
      });
    }

    return this.findOne({ key }).lean(true).then(cache => {
      if (cache) {
        try {
          cache = JSON.parse(cache.value);
        } catch (__) {
          cache = null;
        }
      }

      return cache;
    });
  };


  EmbedzaCache.statics.set = function (key, value) {
    // Store image dimensions cache in redis instead of mongodb
    if (key.indexOf('image#') === 0) {
      // Will expire after one hour
      return N.redis.setex('embedza:' + key, 60 * 60, JSON.stringify(value));
    }

    return this.updateOne({ key }, { value: JSON.stringify(value) }, { upsert: true });
  };


  N.wire.on('init:models', function emit_init_EmbedzaCache() {
    return N.wire.emit('init:models.' + collectionName, EmbedzaCache);
  });


  N.wire.on('init:models.' + collectionName, function init_model_EmbedzaCache(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
