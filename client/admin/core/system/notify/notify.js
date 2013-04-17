'use strict';


var DEFAULT_TYPE = 'error';


var DEFAULT_OPTIONS = {
  info: {
    closable: false
  , autohide: 5000
  }
, error: {
    closable: true
  , autohide: 10000
  }
};


function Notification(target, options) {
  if (!options) {
    options = {};
  } else if ('string' === typeof options) {
    options = { message: options };
  }

  var type = options.type || DEFAULT_TYPE;

  options = $.extend({}, DEFAULT_OPTIONS[type], options);

  this.isShown  = false;
  this.$target  = $(target);
  this.$element = $('<div class="alert alert-' + type + ' fade" />');

  // add close button
  if (options.closable) {
    $('<button type="button" class="close">&times;</button>')
      .click($.proxy(this.hide, this))
      .appendTo(this.$element);
  }

  // add message and inject element into the target container
  this.$element.append(options.message || '');

  // show notification
  this.show();

  if (options.autohide) {
    setTimeout($.proxy(this.hide, this), options.autohide);
  }
}


Notification.prototype = {
  constructor: Notification,

  show: function () {
    if (this.isShown) {
      return;
    }

    this.isShown = true;
    this.$element
      .appendTo(this.$target)
      .addClass('in')
      .focus();
  },

  hide: function () {
    var that = this, timeout;

    if (!this.isShown) {
      return;
    }

    this.isShown = false;
    this.$element.removeClass('in');

    timeout = setTimeout(function () {
      that.$element.off($.support.transition.end);
      that.$element.detach();
    }, 500);

    this.$element.one($.support.transition.end, function () {
      clearTimeout(timeout);
      that.$element.detach();
    });
  }
};


Notification.create = function (target, options) {
  return new Notification(target, options);
};


var $container;


$(function () {
  $container = $('<div class="notifications" />').appendTo('body');
});


N.wire.on('notify', function notification(options) {
  Notification.create($container, options);
});
