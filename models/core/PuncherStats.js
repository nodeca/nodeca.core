'use strict';


const Mongoose    = require('mongoose');
const Schema      = Mongoose.Schema;


module.exports = function (N, collectionName) {

  let PuncherStats = new Schema({
    secret_key:   String,
    data:         String // json
  }, { capped: 100 * 1024 * 1024 /* 100MB */ });


  N.wire.on('init:models', function emit_init_PuncherStats() {
    return N.wire.emit('init:models.' + collectionName, PuncherStats);
  });

  N.wire.on('init:models.' + collectionName, function init_model_PuncherStats(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
