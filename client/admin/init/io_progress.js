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

  if ($notice) {
    // $notice might not be yet initialized when request
    // succeded BEFORE the notification show()
    $notice.hide();
  }

  return;
}


function show(message) {
  // make sure previous timeout was cleared
  clearTimeout(timeout);

  if (!$notice) {
    $notice = $(nodeca.client.common.render.template('common.io_progress'));
    $notice.appendTo('body').find('.close').click(hide);
  }

  $notice.find('.message').html(message).show();

  return;
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
  nodeca.io.on('rpc.complete', hide);

  nodeca.io.on('rpc.request', function () {
    clearTimeout(timeout);

    // schedule showing new message in next 500 ms
    timeout = setTimeout(function () {
      show(nodeca.runtime.t('common.io.progress'));
    }, 500);
  });

  nodeca.io.on('rpc.error', function (err) {
    if (nodeca.io.EWRONGVER === err.code) {
      show(nodeca.runtime.t('common.io.error.version_mismatch'));
    }
  });
};
