// Parser options with which messages are created
//

'use strict';


var memoizee = require('memoizee');
var Mongoose = require('mongoose');
var Schema   = Mongoose.Schema;


module.exports = function (N, collectionName) {

  var MessageParams = new Schema({
    data: String
  }, {
    versionKey: false
  });


  // Indexes
  //////////////////////////////////////////////////////////////////////////////

  // find data by its hash
  MessageParams.index({ data: 'hashed' }, { unique: true });

  var setParams = memoizee(

    function (data, callback) {
      N.models.core.MessageParams.findOneAndUpdate(
        { data: data },
        { $setOnInsert: { data: data } },
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

  // Store parameter set to the database and return its id
  //
  MessageParams.statics.setParams = function (params, callback) {
    params = params || {};

    var sorted = {};

    Object.keys(params).sort().forEach(function (k) {
      sorted[k] = params[k];
    });

    setParams(JSON.stringify(sorted), callback);
  };


  // Get message parameters by message id
  //
  MessageParams.statics.getParams = memoizee(

    function (id, callback) {
      N.models.core.MessageParams.findById(id, function (err, params) {
        if (err) {
          callback(err);
          return;
        }

        var data = {};

        try {
          data = JSON.parse(params.data);
        } catch (__) {
          data = {};
        }

        callback(null, data);
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
