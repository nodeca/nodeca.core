'use strict';


/**
 *  client
 **/

/**
 *  client.common
 **/

/**
 *  client.common.login
 **/


/*global $, _, nodeca*/


/**
 *  client.common.login.send($form, event)
 **/
module.exports.send = function ($form, event) {
  var params = nodeca.client.common.form.getData($form);
  nodeca.client.common.history.navigateTo('login.email', params);
  return false;
};
