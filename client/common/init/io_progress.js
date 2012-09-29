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


/*global $, _, nodeca, window, document*/


var timeout   = null;
var $notice   = $([]);


function hide() {
  clearTimeout(timeout);
  $notice.hide();
}


function init() {
  if (!$notice.length) {
    $notice = $(nodeca.client.common.render.template('common.widgets.notice.io_progress'));
    $notice.appendTo('body').find('.close').click(hide);
    hide();
  }
}


function show() {
  // make sure previous timeout was cleared
  clearTimeout(timeout);

  // schedule showing new message in next 500 ms
  timeout = setTimeout(function () {
    init();
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
