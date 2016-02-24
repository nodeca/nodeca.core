// Abuse reports
//
'use strict';


const Mongoose = require('mongoose');
const Schema   = Mongoose.Schema;


module.exports = function (N, collectionName) {

  let AbuseReport = new Schema({

      // _id of reported content
      src_id: Schema.ObjectId,

      // Content type (FORUM_POST, BLOG_ENTRY, ...)
      type: String,

      // Report text
      text: String,

      // User _id
      from: Schema.ObjectId
    },
    {
      versionKey: false
    });


  N.wire.on('init:models', function emit_init_AbuseReport() {
    return N.wire.emit('init:models.' + collectionName, AbuseReport);
  });

  N.wire.on('init:models.' + collectionName, function init_model_AbuseReport(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
