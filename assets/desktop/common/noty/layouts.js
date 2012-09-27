/*global window, jQuery*/


;(function($) {
  'use strict';


  $.noty.layouts.progress = {
    name: 'progress',
    options: {}, // overrides options
    container: {
      object:   '<div id="notice-progress-container" />',
      selector: 'div#notice-progress-container',
      style:    $.noop,
    },
    parent: {
      object:   '<div class="notice-element" />',
      selector: 'div.notice-element',
      css:      {}
    },
    css: {
      display:  'none',
      width:    '310px'
    },
    addClass: ''
  };


  $.noty.layouts.notification = {
    name: 'notification',
    options: {}, // overrides options
    container: {
      object:   '<div id="notice-notification-container" />',
      selector: 'div#notice-notification-container',
      style:    $.noop,
    },
    parent: {
      object:   '<div class="notice-element" />',
      selector: 'div.notice-element',
      css:      {}
    },
    css: {
      display: 'none',
      width: '310px'
    },
    addClass: ''
  };
})(jQuery);

