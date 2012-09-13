'use strict';


/**
 *  models
 **/

/**
 *  models.core
 **/


/**
 *  class models.core.AuthData
 *
 *  Users auth data changelog
 **/

/*global nodeca*/



var mongoose = nodeca.runtime.mongoose;
var Schema = mongoose.Schema;
////////////////////////////////////////////////////////////////////////////////


/**
 *  new models.core.AuthChangeLog()
 *
 *  Create new odm object
 **/
var AuthChangeLog= new Schema({
  user_id: Schema.ObjectId,
  action: String,
  date: Date,
  ip:  String,
  data: Schema.Types.Mixed
});


module.exports.__init__ = function __init__() {
  return mongoose.model('core.AuthChangeLog', AuthChangeLog);
};
