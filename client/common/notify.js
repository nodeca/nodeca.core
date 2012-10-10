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
    notify(nodeca.client.common.render.template('common.io.error.version'), {
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
    notify(nodeca.client.common.render.template('common.io.error.csrf_token'));
    return;
  }

  if (nodeca.io.APP_ERROR === err.code) {
    notify(nodeca.client.common.render.template('common.io.error.application'));
    return;
  }

  if (!err.code) {
    notify(nodeca.client.common.render.template('common.io.error.communication'));
    return;
  }
});


////////////////////////////////////////////////////////////////////////////////


module.exports = notify;
