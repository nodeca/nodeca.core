'use strict';


/*global $, nodeca*/


var $container;


////////////////////////////////////////////////////////////////////////////////


var defaults = {
  'info':   { closable: false, autohide: 5000 },
  'error':  { closable: true, autohide: 10000 }
};


function notify(type, message, options) {
  if ('string' !== typeof message) {
    options = message;
    message = type;
    type    = 'error';
  }

  if (!$container) {
    $container = $('<div class="notifications" />').appendTo('body');
  }

  $container.notification($.extend({}, defaults[type], options, {
    type:     type,
    message:  message
  }));

  return;
}


//
// Subscribe for IO events
//


nodeca.io.on('rpc.error', function (err) {
  if (nodeca.io.INVALID_CSRF_TOKEN === err.code) {
    nodeca.runtime.csrf = err.data.token;
    notify(nodeca.runtime.t('common.io.error.invalid_csrf_token'));
    return;
  }

  if (nodeca.io.APP_ERROR === err.code) {
    notify(nodeca.runtime.t('common.io.error.application_fuckup'));
    return;
  }

  if (nodeca.io.ECOMMUNICATION === err.code) {
    notify(nodeca.runtime.t('common.io.error.communication_timeout'));
    return;
  }
});


////////////////////////////////////////////////////////////////////////////////


module.exports = notify;
