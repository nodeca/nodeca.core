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
var $container;
var $message;
var messagesCache = {};


function hide() {
  clearTimeout(timeout);
  $container.hide();
}


function getContainer(id) {
  if (!$container) {
    $container  = $(nodeca.client.common.render.template('common.io_progress'));
    $message    = $container.find('.message');

    $container.appendTo('body').find('.close').click(hide);
  }

  if (!messagesCache[id]) {
    messagesCache[id] = nodeca.runtime.t(id);
  }

  $message.html(messagesCache[id]);

  return $container;
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
      getContainer('common.io.progress').show();
    }, 500);
  });

  nodeca.io.on('rpc.error', function (err) {
    if (nodeca.io.EWRONGVER === err.code) {
      clearTimeout(timeout);
      getContainer('common.io.error.version').show();
    }
  });
};
