'use strict';


/**
 *  models
 **/


/**
 *  class models.app_settings
 *
 *  Description of the model.
 **/


/*global nodeca*/

var mongoose = nodeca.components.mongoose;

/**
 *  new models.app_settings()
 **/
module.exports = new mongoose.Schema({
  app_name: { type: String },
  settings: { type: mongoose.Schema.Types.Mixed, default: {}}
});


module.exports.__init__ = function () {
  return mongoose.model('app_settings', module.exports);
};
