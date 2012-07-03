'use strict';

/*global nodeca*/


var mongoose = nodeca.runtime.mongoose;
var Schema = mongoose.Schema;

var Migration = module.exports.Migration = new mongoose.Schema({
  _id: { type:String, unique: true},    // app name
  steps: [String]                       // array of migration files for app
}, { strict: true });

/**
 * Write used migration step in db
 *
 */
Migration.statics.markPassed = function (app_name, step, callback) {
  var model = this;
  model.find({_id: app_name}, function(err, docs) {
    if (docs.length > 0) {
      model.update({_id: app_name}, { $push: { steps: step }}, callback);
    }
    else {
      model.create({_id: app_name, steps: [step]}, callback);
    }
  });
};

/**
 * Fetch and format migrations from db
 */
Migration.statics.getLastState = function (callback) {
  this.find({}, function(err, docs) {
    var last_state = {};
    if (!err) {
      for (var i = 0; i < docs.length; i++) {
        last_state[docs[i]._id] = docs[i].steps;
      }
    }
    callback(err, last_state);
  });
};

module.exports.__init__ = function __init__() {
  return mongoose.model('core.Migration', Migration);
};
