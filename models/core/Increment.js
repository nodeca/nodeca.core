'use strict';


const Mongoose = require('mongoose');
const Schema   = Mongoose.Schema;


module.exports = function (N, collectionName) {

  let Increment = new Schema({

    key:    String,   // Counter name
    value:  Number    // Counter last value
  });

  Increment.statics.next = function next(name, callback) {
    let query = this.findOneAndUpdate(
      { key: name },
      { $inc: { value: 1 } },
      { new: true, upsert: true }
    );

    if (!callback) {
      return query.then(counter => counter.value);
    }

    query.exec((err, counter) => { callback(err, (counter || {}).value); });
  };

  N.wire.on('init:models', function emit_init_Increment() {
    return N.wire.emit('init:models.' + collectionName, Increment);
  });

  N.wire.on('init:models.' + collectionName, function init_model_Increment(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
