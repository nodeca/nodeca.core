'use strict';


/*global $, nodeca*/


var containers = {};


////////////////////////////////////////////////////////////////////////////////


var defaults = {
  'info':   { closable: false, autohide: 5000 },
  'error':  { closable: true, autohide: 10000 }
};


function notify(type, message, options) {
  var notice, position;

  if ('string' !== typeof message) {
    options = message;
    message = type;
    type    = 'error';
  }

  position = options.position || 'top-right';

  if (!containers[position]) {
    containers[position] = $('<div class="notifications ' + position + '" />').appendTo('body');
  }

  containers[position].notification($.extend({}, defaults[type], options, {
    type:     type,
    message:  message
  }));

  return;
}


//
// Subscribe for IO events
//


nodeca.io.on('rpc.error', function (err) {
  if (nodeca.io.EWRONGVER === err.code) {
    notify('You need to reload the page.', {
      closable: false,
      autohide: false,
      position: 'top-center'
    });

    // disable IO
    nodeca.io.apiTree = $.noop;

    return;
  }

  if (nodeca.io.INVALID_CSRF_TOKEN === err.code) {
    nodeca.runtime.csrf = err.data.token;
    notify('Session reset. Please, try again');
    return;
  }

  if (nodeca.io.APP_ERROR === err.code) {
    notify('Application Error. Try again later.');
    return;
  }

  if (!err.code) {
    notify('Communication problems');
    return;
  }
});


////////////////////////////////////////////////////////////////////////////////


module.exports = notify;
