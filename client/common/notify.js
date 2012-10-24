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


////////////////////////////////////////////////////////////////////////////////


module.exports = notify;
