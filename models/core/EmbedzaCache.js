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
    // Get image dimensions cache from redis instead of mongodb
    if (key.indexOf('image#') === 0) {
      N.redis.get('embedza:' + key, function (err, cache) {
        if (err) {
          callback(err);
          return;
        }

        if (cache) {
          try {
            cache = JSON.parse(cache);
          } catch (__) {
            cache = null;
          }
        }

        callback(null, cache);
      });

      return;
    }

    this.findOne({ key }).lean(true).exec(function (err, result) {
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
    // Store image dimensions cache in redis instead of mongodb
    if (key.indexOf('image#') === 0) {
      // Will expire after one hour
      N.redis.setex('embedza:' + key, 60 * 60, JSON.stringify(value), callback);
      return;
    }

    this.update({ key }, { value }, { upsert: true }, callback);
  };


  N.wire.on('init:models', function emit_init_EmbedzaCache(__, callback) {
    N.wire.emit('init:models.' + collectionName, EmbedzaCache, callback);
  });


  N.wire.on('init:models.' + collectionName, function init_model_EmbedzaCache(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
