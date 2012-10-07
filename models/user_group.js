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

var mongoose = nodeca.components.mongoose;


/**
 *  new models.user_group()
 **/
module.exports = new mongoose.Schema({
  // shortcut name for the group
  name:     { type: String },
  // human readable title
  title:    { type: String },
  settings: { type: mongoose.Schema.Types.Mixed, default: {}}
});


module.exports.__init__ = function () {
  return mongoose.model('user_group', module.exports);
};
