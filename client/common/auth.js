'use strict';


/**
 *  client
 **/

/**
 *  client.common
 **/

/**
 *  client.common.auth
 **/


/*global $, _, nodeca*/


/**
 *  client.common.auth.login($form, event)
 *
 *  send login request
 **/
module.exports.login = function ($form, event) {
  var params = nodeca.client.common.form.getData($form);
  // FIXME validate data and strengthen password
  nodeca.client.common.history.navigateTo('login.email', params);
  return false;
};

/**
 *  client.common.auth.register($form, event)
 *
 *  send registration data on server
 **/
module.exports.register = function ($form, event) {
  var params = nodeca.client.common.form.getData($form);
  // FIXME validate data and strengthen password
  nodeca.client.common.history.navigateTo('registration.register', params);
  return false;
};
