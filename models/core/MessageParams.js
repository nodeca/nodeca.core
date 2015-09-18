// Parser options with which messages are created
//

'use strict';


var crypto   = require('crypto');
var memoizee = require('memoizee');
var Mongoose = require('mongoose');
var Schema   = Mongoose.Schema;


module.exports = function (N, collectionName) {

  var MessageParams = new Schema({
    hash: String,
    data: Schema.Types.Mixed
  }, {
    versionKey: false
  });


  // Indexes
  //////////////////////////////////////////////////////////////////////////////

  // find data by its hash
  MessageParams.index({ key: 'hashed', unique: true });

  // Store parameter set to the database and return its id
  //
  MessageParams.statics.setParams = memoizee(

    function (params, callback) {
      params = params || {};

      var sorted = {};

      Object.keys(params).sort().forEach(function (k) {
        sorted[k] = params[k];
      });

      var hash = crypto.createHash('sha1')
                       .update(JSON.stringify(sorted))
                       .digest('hex');

      this.findOneAndUpdate(
        { hash: hash },
        { $setOnInsert: { hash: hash, data: params } },
        { 'new': true, upsert: true },
        function (err, found) {
          if (err) {
            callback(err);
            return;
          }

          callback(null, found._id);
        }
      );
    },
    {
      async:     true,
      primitive: true  // params keys are calculated as toString
    }
  );


  // Get message parameters by message id
  //
  MessageParams.statics.getParams = memoizee(

    function (id, callback) {
      N.models.core.MessageParams.findById(id, function (err, params) {
        if (err) {
          callback(err);
          return;
        }

        if (!params) { params = {}; }

        callback(null, params.data || {});
      });
    },
    {
      async:     true,
      primitive: true  // params keys are calculated as toString
    }
  );

  N.wire.on('init:models', function emit_init_MessageParams(__, callback) {
    N.wire.emit('init:models.' + collectionName, MessageParams, callback);
  });


  N.wire.on('init:models.' + collectionName, function init_model_MessageParams(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
