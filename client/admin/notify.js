'use strict';


/*global $*/


var $container;


////////////////////////////////////////////////////////////////////////////////


module.exports = function notify(type, message, options) {
  var notice;

  if ('string' !== typeof message) {
    options = message;
    message = type;
    type    = 'error';
  }

  options = options || {};
  message = message || '';

  if (!$container) {
    $container = $('<div class="notifications top-right" />').appendTo('body');
  }

  notice = $container.notify({
    type:       type,
    closable:   ( 'undefined' === typeof options.closable ) ? true : !!options.closable,
    fadeOut:    { enabled: !!options.autoclose, delay: +options.autoclose || 3000 },
    message:    { html: message }
  });

  notice.show();
  return notice;
};
