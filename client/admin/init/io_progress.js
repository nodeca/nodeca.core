'use strict';


/**
 *  client
 **/

/**
 *  client.admin
 **/

/**
 *  client.admin.init
 **/


/*global $, N*/


var timeout;
var $notice;


var render = require("../../../lib/system/render/client");


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
    $notice = $(render.template('admin.io_progress'));
    $notice.appendTo('body').find('.close').click(hide);
  }

  $notice.find('.message').html(message).show();

  return;
}


/**
 *  client.admin.init.io_progress()
 *
 *  Assigns rpc before/after request handlers showing/hiding "loading" notice.
 *
 *
 *  ##### Example
 *
 *      nodeca.client.admin.init.io_progress();
 **/
module.exports = function () {
  N.on('rpc.complete', hide);

  N.on('rpc.request', function () {
    clearTimeout(timeout);

    // schedule showing new message in next 500 ms
    timeout = setTimeout(function () {
      show(N.runtime.t('admin.io.progress'));
    }, 500);
  });

  N.on('rpc.error', function (err) {
    if (N.io.EWRONGVER === err.code) {
      show(N.runtime.t('admin.io.error.version_mismatch'));
    }
  });
};
