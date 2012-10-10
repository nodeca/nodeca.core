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
  var data = this.response.data;

  data.categories = [];
  nodeca.settings.global.getCategories().forEach(function (category) {
    data.categories.push(category);
  });

  next();
};
