'use strict';


var Mongoose = require('mongoose');
var Schema   = Mongoose.Schema;


////////////////////////////////////////////////////////////////////////////////


module.exports = function (N, collectionName) {
  var GlobalSettings = new Schema({
    _id: { type: String, unique: true},
    value: { type: Schema.Types.Mixed, default: {}}
  }, {strict: true});


  GlobalSettings.statics.get = function () {

  };


  /**
   *  models.stores.GlobalSettings.set(key, value, callback) -> Void
   **/
  GlobalSettings.statics.set = function (key, value, callback) {
    var model = this;
    model.findOne({_id: key}, function (err, doc) {
      if (err) {
        callback(err);
        return;
      }

      if (doc) {
        model.update({_id: key}, { value: value }, callback);
      } else {
        model.create({_id: key, value: [value]}, callback);
      }
    });
  };


  GlobalSettings.__init__ = function __init__() {
    return Mongoose.model(collectionName, GlobalSettings);
  };


  return GlobalSettings;
};
