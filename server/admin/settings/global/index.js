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


/*global nodeca*/


// Validate input parameters
//
var params_schema = {
};
nodeca.validate(params_schema);


/**
 *  server.admin.settings.global.index(params, callback) -> Void
 *
 *  Global settings
 **/
module.exports = function (params, next) {
  this.response.data.categories = nodeca.settings.getStore('global').getCategories();
  next();
};
