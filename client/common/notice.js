'use strict';


/*global $, nodeca*/


var stacks = {};


////////////////////////////////////////////////////////////////////////////////


stacks.info = stacks.success = stacks.error = (function () {
  var $container = $([]);

  return function (message, options) {
    var notice;

    if (!$container.length) {
      $container = $('<div class="notifications top-right" />').appendTo('body');
    }

    notice = $container.notify({
      type:       options.type,
      closable:   ( 'undefined' === typeof options.closable ) ? true : !!options.closable,
      fadeOut:    { enabled: !!options.autoclose, delay: +options.autoclose || 3000 },
      message:    { html: message }
    });

    notice.show();
    return notice;
  };
}());


////////////////////////////////////////////////////////////////////////////////


module.exports = function (type, message, options) {
  if ('string' !== typeof message) {
    options = message;
    message = type;
    type    = 'error';
  }

  options = options || {};
  message = message || '';
  type    = options.type = !!stacks[type] ? type : 'error';

  return stacks[type](message, options);
};
