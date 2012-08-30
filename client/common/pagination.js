'use strict';


/**
 *  client
 **/

/**
 *  client.common
 **/


/*global $, _, nodeca*/


/**
 *  client.common.pagination($btn, event)
 **/
module.exports = function ($btn, event) {
  var data = $btn.data('pagination');

  if (!data) {
    return;
  }

  $.extend(data.params, {page: +$btn.prev('input').val()});
  nodeca.client.common.history.goto(data.route, data.params);

  return false;
};
