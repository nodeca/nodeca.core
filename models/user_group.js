'use strict';


/**
 *  models
 **/


/**
 *  class models.user_group
 *
 *  Description of the model.
 **/


/*global nodeca*/


/**
 *  new models.user_group()
 **/
module.exports = new nodeca.runtime.mongoose.Schema({
  // shortcut name for the group
  name:     { type: String },
  // human readable title
  title:    { type: String },
  settings: { type: nodeca.runtime.mongoose.Schema.Types.Mixed, default: {}}
});


module.exports.__init__ = function () {
  return nodeca.runtime.mongoose.model('user_group', module.exports);
};
