'use strict';


var defaults = {
  info:  { type: 'info',  closable: false, autohide: 5000  }
, error: { type: 'error', closable: true,  autohide: 10000 }
};


var $container;


$(function () {
  $container = $('<div class="notifications" />').appendTo('body');
});


N.wire.on('notify', function notification(options) {
  if ('string' === typeof options) {
    options = { message: options };
  }

  var type = options.type || 'error';

  $container.notification($.extend({}, defaults[type], options));
});
