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


/*global $, _, nodeca*/


/**
 *  client.common.pagination.change($form, event)
 **/
module.exports.change = function ($form, event) {
  var data = $form.data('pagination');

  if (!data) {
    return;
  }

  $.extend(data.params, {page: $form.find('input:eq(0)').val()});
  nodeca.client.common.history.navigateTo(data.route, data.params);

  return false;
};
