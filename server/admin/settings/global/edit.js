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
  // thread id
  id: {
    type: 'string',
    required: true
  }
};
nodeca.validate(params_schema);


/**
 *  server.admin.settings.global.edit(params, callback) -> Void
 *
 *  Edit global setings
 **/
module.exports = function (params, next) {
  var data = this.response.data;
  var category_name = params.id;

  data.category_name = category_name;
  data.category = nodeca.settings.global.fetchSettingsByCategory(category_name);

  next();
};
