// Single-document collection storing global settings.
//


'use strict';


var Mongoose = require('mongoose');
var Schema   = Mongoose.Schema;


module.exports = function (N, collectionName) {
  var GlobalSettings = new Schema({
    data: { type: Schema.Types.Mixed, default: {} }
  });


  N.wire.on('init:models', function emit_init_GlobalSettings() {
    return N.wire.emit('init:models.' + collectionName, GlobalSettings);
  });


  N.wire.on('init:models.' + collectionName, function init_model_GlobalSettings(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
