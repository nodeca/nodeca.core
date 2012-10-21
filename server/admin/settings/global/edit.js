'use strict';


/*global nodeca, _*/


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

  nodeca.settings.getStore('global').fetchSettingsByCategory(category_name, function (err, settings) {
    _.each(settings, function (obj, key) {
      _.defaults(obj, nodeca.settings.getStore('global').getSchema(key));
    });

    data.category = settings;

    next(err);
  });
};
