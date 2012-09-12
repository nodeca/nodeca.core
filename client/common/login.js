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
 *  client.common.login.send($btn, event)
 **/
module.exports.send = function ($btn, event) {
  var data = {};
  $.each($($btn.eq(0).form).serializeArray(), function () {
    data[this.name] = this.value;
  });
  nodeca.client.common.history.navigateTo('login.email', data);

  return false;
};
