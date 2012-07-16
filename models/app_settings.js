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


/**
 *  new models.app_settings()
 **/
module.exports = new nodeca.runtime.mongoose.Schema({
  app_name: { type: String },
  settings: { type: nodeca.runtime.mongoose.Schema.Types.Mixed, default: {}}
});


module.exports.__init__ = function () {
  return nodeca.runtime.mongoose.model('app_settings', module.exports);
};
