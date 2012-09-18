'use strict';


/**
 *  server
 **/

/**
 *  server.admin
 **/


/*global nodeca*/


// Validate input parameters
//
var params_schema = {
};
nodeca.validate(params_schema);


/**
 *  server.admin.dashboard(params, callback) -> Void
 *
 *  Administration dashboard
 **/
module.exports = function (params, next) {
  this.response.data.now = (new Date).toString();
  next();
};
