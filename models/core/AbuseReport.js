// Abuse reports
//
'use strict';


const Mongoose = require('mongoose');
const Schema   = Mongoose.Schema;


module.exports = function (N, collectionName) {

  let AbuseReport = new Schema({

    // _id of reported content
    src: Schema.ObjectId,

    // N.shared.content_type (FORUM_POST, BLOG_ENTRY, ...)
    type: Number,

    // Report text
    text: String,

    // Additional data for custom forms
    data: Schema.Types.Mixed,

    // Flag defining whether this report was created automatically
    auto_reported: Boolean,

    // Parser options
    params_ref: Schema.ObjectId,

    // User _id
    from: Schema.ObjectId
  }, {
    versionKey: false
  });

  // Duplicate check for auto-created abuse reports
  AbuseReport.index({ src: 1, auto_reported: 1 }, { sparse: true });


  N.wire.on('init:models', function emit_init_AbuseReport() {
    return N.wire.emit('init:models.' + collectionName, AbuseReport);
  });

  N.wire.on('init:models.' + collectionName, function init_model_AbuseReport(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
