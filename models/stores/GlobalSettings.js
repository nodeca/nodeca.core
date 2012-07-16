'use strict';


/**
 *  models
 **/

/**
 *  models.stores
 **/


/**
 *  class models.stores.GlobalSettings
 *
 *  Description of the model.
 **/


/*global nodeca*/


var mongoose  = nodeca.runtime.mongoose;
var Schema    = mongoose.Schema;


////////////////////////////////////////////////////////////////////////////////


/**
 *  new models.stores.GlobalSettings()
 **/
var GlobalSettigs = module.exports.GlobalSettigs = new mongoose.Schema({
  _id: { type: String, unique: true},
  value: { type: Schema.Types.Mixed, default: {}}
}, {strict: true});

GlobalSettigs.statics.get = function() {

};


/**
 *  models.stores.GlobalSettings.set(key, value, callback) -> Void
 **/
GlobalSettigs.statics.set= function (key, value, callback) {
  var model = this;
  model.findOne({_id: key}, function(err, doc) {
    if (doc) {
      model.update({_id: key}, { value: value }, callback);
    }
    else {
      model.create({_id: key, value: [value]}, callback);
    }
  });
};


module.exports.__init__ = function __init__() {
  return mongoose.model('stores.GlobalSettings', GlobalSettigs);
};
