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


var NLib = require('nlib');

var _ = NLib.Vendor.Underscore;


// Validate input parameters
//
var params_schema = {
}
nodeca.validate(params_schema);


/**
 *  server.admin.settings.global.index(params, callback) -> Void
 *
 *  Global settings
 **/
module.exports = function (params, next) {
  var data = this.response.data;

  data.groups = [];
  nodeca.settings.global.getGroups().forEach(function(group){
    data.groups.push(group);
  });

  next();
};
