'use strict';


/**
 *  client
 **/

/**
 *  client.common
 **/

/**
 *  client.common.pagination
 **/


/*global $, nodeca*/


/**
 *  client.common.pagination.change($form, event)
 **/
module.exports.change = function ($form, event) {
  var data = $form.data('pagination');

  if (!data) {
    return;
  }

  $.extend(data.params, nodeca.client.common.form.getData($form));
  nodeca.client.common.history.navigateTo(data.route, data.params);

  return false;
};
