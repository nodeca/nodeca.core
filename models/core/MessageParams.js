// Parser options with which messages are created
//

'use strict';


const memoize  = require('promise-memoize');
const Mongoose = require('mongoose');
const Schema   = Mongoose.Schema;


module.exports = function (N, collectionName) {

  let MessageParams = new Schema({
    data: String
  }, {
    versionKey: false
  });


  // Indexes
  //////////////////////////////////////////////////////////////////////////////

  // find data by its hash
  MessageParams.index({ data: 'hashed' });

  let setParams = memoize(
    data => N.models.core.MessageParams.findOneAndUpdate(
              { data },
              { $setOnInsert: { data } },
              { new: true, upsert: true }
            ).then(found => found._id)
  );

  // Store parameter set to the database and return its id
  //
  MessageParams.statics.setParams = function (params) {
    params = params || {};

    let sorted = {};

    Object.keys(params).sort().forEach(k => { sorted[k] = params[k]; });

    return setParams(JSON.stringify(sorted));
  };


  // Get message parameters by message id
  //
  MessageParams.statics.getParams = memoize(
    id => N.models.core.MessageParams.findById(id)
            .then(params => {
              let data = {};

              try {
                data = JSON.parse(params.data);
              } catch (__) {
                data = {};
              }

              return data;
            })
  );

  N.wire.on('init:models', function emit_init_MessageParams() {
    return N.wire.emit('init:models.' + collectionName, MessageParams);
  });


  N.wire.on('init:models.' + collectionName, function init_model_MessageParams(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
