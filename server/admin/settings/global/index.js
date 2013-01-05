'use strict';


/**
 *  server
 **/

/**
 *  server.admin
 **/

/**
 *  server.admin.settings
 **/

/**
 *  server.admin.settings.global
 **/


/*global N*/


// Validate input parameters
//
var params_schema = {
};
N.validate(params_schema);


/**
 *  server.admin.settings.global.index(params, callback) -> Void
 *
 *  Global settings
 **/
module.exports = function (params, next) {
  this.response.data.categories = N.settings.getStore('global').getCategories();
  next();
};
