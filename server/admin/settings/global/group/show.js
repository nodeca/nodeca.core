'use strict';


/**
 *  server
 **/

/**
 *  server.settings
 **/

/**
 *  server.settings.global
 **/

/**
 *  server.settings.global.group
 **/


/*global nodeca*/


/**
 *  server.admin.settings.global.group.show(params, callback) -> Void
 *
 *  Show group settings
 **/
module.exports = function (params, next) {
  var data = this.response.data;
  var group_name = params.id;

  data.group_name = group_name;
  data.group = nodeca.settings.global.fetchSettingsByGroup(group_name);

  next();
};
