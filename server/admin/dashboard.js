'use strict';


/**
 *  server
 **/

/**
 *  server.admin
 **/


/*global N*/


// Validate input parameters
//
var params_schema = {
};
N.validate(params_schema);


/**
 *  server.admin.dashboard(params, callback) -> Void
 *
 *  Administration dashboard
 **/
module.exports = function (params, next) {
  this.response.data.now = (new Date).toString();
  next();
};
