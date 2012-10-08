'use strict';


/**
 *  client
 **/

/**
 *  client.common
 **/

/**
 *  client.common.init
 **/


/*global $, nodeca*/


var timeout;
var $notice;


function hide() {
  clearTimeout(timeout);
  $notice.hide();
}


function show() {
  // make sure previous timeout was cleared
  clearTimeout(timeout);

  if (!$notice) {
    $notice = $(nodeca.client.common.render.template('common.io_progress'));
    $notice.appendTo('body').find('.close').click(hide);
  }

  // schedule showing new message in next 500 ms
  timeout = setTimeout(function () {
    $notice.show();
  }, 500);
}


/**
 *  client.common.init.io_progress()
 *
 *  Assigns rpc before/after request handlers showing/hiding "loading" notice.
 *
 *
 *  ##### Example
 *
 *      nodeca.client.common.init.io_progress();
 **/
module.exports = function () {
  nodeca.io.on('rpc.request',   show);
  nodeca.io.on('rpc.complete',  hide);
};
