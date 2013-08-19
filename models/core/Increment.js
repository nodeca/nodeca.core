'use strict';


var Mongoose = require('mongoose');
var Schema   = Mongoose.Schema;


module.exports = function (N, collectionName) {

  var Increment = new Schema({

    key          : String    // Counter name
  , value        : Number    // Counter last value
  });

  Increment.statics.next = function next(name, callback) {
    var res = this.collection.findAndModify( { key: name }, null, { $inc: { value: 1 } }, { new: true, upsert: true },
      function(err, counter) {
        if (err) {
          callback(err, null);
          return;
        }
        callback(null, counter.value);
      }
    );
  }

  N.wire.on("init:models", function emit_init_Increment(__, callback) {
    N.wire.emit("init:models." + collectionName, Increment, callback);
  });

  N.wire.on("init:models." + collectionName, function init_model_Increment(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
