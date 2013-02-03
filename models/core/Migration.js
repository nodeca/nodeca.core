'use strict';


var Mongoose = require('mongoose');


////////////////////////////////////////////////////////////////////////////////


module.exports = function (N, collectionName) {
  /**
   *  new models.core.Migration()
   *
   *  Description
   **/
  var Migration = new Mongoose.Schema({
    _id: { type: String, unique: true}, // app name
    steps: [String]                     // array of migration files for app
  }, { strict: true });


  /**
   * models.core.Migration.markPassed(app_name, step, callback) -> Void
   *
   * Write used migration step in db
   **/
  Migration.statics.markPassed = function (app_name, step, callback) {
    var model = this;

    model.find({_id: app_name}, function (err, docs) {
      if (err) {
        callback(err);
        return;
      }

      if (docs.length > 0) {
        model.update({_id: app_name}, { $push: { steps: step }}, callback);
      } else {
        model.create({_id: app_name, steps: [step]}, callback);
      }
    });
  };


  /**
  * models.core.Migration.getLastState(callback) -> Void
  *
  * Fetch and format migrations from db
  **/
  Migration.statics.getLastState = function (callback) {
    this.find({}, function (err, docs) {
      var last_state = {};
      if (!err) {
        for (var i = 0; i < docs.length; i++) {
          last_state[docs[i]._id] = docs[i].steps;
        }
      }
      callback(err, last_state);
    });
  };


  N.wire.on("init:models", function emit_init_Migration(__, callback) {
    N.wire.emit("init:models." + collectionName, Migration, callback);
  });

  N.wire.on("init:models." + collectionName, function init_model_Migration(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
