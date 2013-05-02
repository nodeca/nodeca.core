// Special collection for storing single non-repeatable objects identified by a
// string key. In contrast to Redis, it is intended for long-life data that
// affects server work - like global settings.
//


'use strict';


var Mongoose = require('mongoose');
var Schema   = Mongoose.Schema;


module.exports = function (N, collectionName) {
  var KeyValueStorage = new Schema({
    key:   { type: String, index: true, unique: true   }
  , value: { type: Schema.Types.Mixed, 'default': null }
  });


  N.wire.on('init:models', function emit_init_KeyValueStorage(__, callback) {
    N.wire.emit('init:models.' + collectionName, KeyValueStorage, callback);
  });


  N.wire.on('init:models.' + collectionName, function init_model_KeyValueStorage(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
