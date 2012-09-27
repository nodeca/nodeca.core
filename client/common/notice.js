'use strict';


/*global $, nodeca*/


var stacks = {};


////////////////////////////////////////////////////////////////////////////////


stacks.progress = (function () {
  var $notice = $([]), $message = $([]), singleton = {};

  function init() {
    if (!$notice.length) {
      $notice   = $(nodeca.views.common.widgets.notice());
      $message  = $notice.find('.message');

      $notice.appendTo($('body'));
      $notice.find('.close').click(singleton.hide);

      singleton.hide();
    }
  }

  singleton.hide = function () {
    $notice.hide();
    $message.html('');

    return singleton;
  };

  singleton.show = function (message) {
    init();
    $message.html(message);
    $notice.show();

    return singleton;
  };


  return function (options) {
    return singleton.show(options.html || options.text || '');
  };
}());


////////////////////////////////////////////////////////////////////////////////


stacks.info = (function () {
  var $container = $([]);

  return function (options) {
    var notice;

    if (!$container.length) {
      $container = $('<div class="notifications top-right" />').appendTo('body');
    }

    notice = $container.notify({
      type:       options.level || 'info',
      closable:   ( 'undefined' === typeof options.closable ) ? true : !!options.closable,
      fadeOut:    { enabled: !!options.autoclose, delay: +options.autoclose || 3000 },
      message:    { html: options.html, text: options.text }
    });

    notice.show();
    return notice;
  };
}());

////////////////////////////////////////////////////////////////////////////////


module.exports = function (options) {
  return (stacks[options.type] || stacks.info)(options);
};
