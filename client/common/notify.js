'use strict';


/*global $*/


var $container;


////////////////////////////////////////////////////////////////////////////////


var defaults = {
  'info':   { closable: false, autohide: 5000 },
  'error':  { closable: true, autohide: 10000 }
};


module.exports = function notify(type, message, options) {
  var notice;

  if ('string' !== typeof message) {
    options = message;
    message = type;
    type    = 'error';
  }

  if (!$container) {
    $container = $('<div class="notifications top-right" />').appendTo('body');
  }

  $container.notification($.extend({}, defaults[type], options, {
    type:     type,
    message:  message
  }));

  return;
};
