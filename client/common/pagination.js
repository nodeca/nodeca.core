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
 *  client.common.pagination.change($btn, event)
 **/
module.exports.change = function ($btn, event) {
  var data = $btn.data('pagination');

  if (!data) {
    return;
  }

  $.extend(data.params, {page: +$btn.prev('input').val()});
  nodeca.client.common.history.navigateTo(data.route, data.params);

  return false;
};
