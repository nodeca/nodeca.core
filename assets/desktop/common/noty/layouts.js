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
      display:  'none'
    },
    addClass: ''
  };


  $.noty.layouts.info = {
    name: 'info',
    options: {}, // overrides options
    container: {
      object:   '<div id="notice-info-container" />',
      selector: 'div#notice-info-container',
      style:    $.noop,
    },
    parent: {
      object:   '<div class="notice-element" />',
      selector: 'div.notice-element',
      css:      {}
    },
    css: {
      display: 'none'
    },
    addClass: ''
  };
})(jQuery);

