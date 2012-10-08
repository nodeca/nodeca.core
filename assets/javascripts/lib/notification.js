/*global window*/

(function ($) {
  "use strict";


  var defaults = {
    type:     'info',
    message:  '',
    closable: true,
    autohide: 5000
  };


  var Notification = function Notification(target, options) {
    options = $.extend({}, defaults, options);

    this.isShown  = false;
    this.$target  = $(target);
    this.$element = $('<div class="alert alert-' + options.type + ' fade" />');

    // add close button
    if (options.closable) {
      $('<button type="button" class="close">&times;</button>')
        .click($.proxy(this.hide, this))
        .appendTo(this.$element);
    }

    // add message and inject element into the target container
    this.$element.append(options.message);

    // show notification
    this.show();

    if (options.autohide) {
      setTimeout($.proxy(this.hide, this), options.autohide);
    }
  };


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


  $.fn.notification = function (options) {
    return this.each(function () {
      Notification.create(this, options);
    });
  };
}(window.jQuery));
