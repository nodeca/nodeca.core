'use strict';


/**
 *  models
 **/

/**
 *  models.core
 **/


/**
 *  class models.core.AuthLink
 *
 *  Description of the model.
 **/


/*global nodeca*/



var mongoose = nodeca.runtime.mongoose;
var Schema = mongoose.Schema;

var Crypto = require('crypto');
////////////////////////////////////////////////////////////////////////////////



/**
 *  new models.core.AuthLink()
 *
 *  Description
 **/
var AuthLink = module.exports.AuthLink = new mongoose.Schema({
  _id:        { type:String, unique: true},   //
  user_id:            Schema.ObjectId,
  provider:           String,                 //
  external_user_id:   String,
  email:              String,                 //
  auth_data:          Schema.Types.Mixed      // denormalisation, last auth data
}, { strict: true });


var hash = function(password, salt) {
  return Crypto.createHmac('sha256', salt).update(password).digest('hex');
};

AuthLink.methods.setPass = function(password) {
  this.auth_data.pass = hash(password, password + this.user_id);
};

AuthLink.methods.checkPass = function(password) {
  return this.auth_data.pass === hash(password, password + this.user_id);
};

module.exports.__init__ = function __init__() {
  return mongoose.model('core.AuthLink', AuthLink);
};
