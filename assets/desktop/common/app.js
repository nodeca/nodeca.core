//= require noty


/*global window, jQuery*/


;(function($) {
  'use strict';


  $.noty.layouts.progress = {
    name: 'progress',
    options: {}, // overrides options
    container: {
      object: '<ul id="noty_topCenter_layout_container" />',
      selector: 'ul#noty_topCenter_layout_container',
      style: function() {
        $(this).css({
          top: 20,
          left: 0,
          position: 'fixed',
          width: '310px',
          height: 'auto',
          margin: 0,
          padding: 0,
          listStyleType: 'none',
          zIndex: 10000000
        });

        $(this).css({
          left: ($(window).width() - $(this).outerWidth()) / 2 + 'px'
        });
      }
    },
    parent: {
      object: '<li />',
      selector: 'li',
      css: {}
    },
    css: {
      display: 'none',
      width: '310px'
    },
    addClass: ''
  };


  $.noty.layouts.notification = {
    name: 'notification',
    options: {}, // overrides options
    container: {
      object: '<ul id="noty_topRight_layout_container" />',
      selector: 'ul#noty_topRight_layout_container',
      style: function() {
        $(this).css({
          top: 20,
          right: 20,
          position: 'fixed',
          width: '310px',
          height: 'auto',
          margin: 0,
          padding: 0,
          listStyleType: 'none',
          zIndex: 10000000
        });

        if (window.innerWidth < 600) {
          $(this).css({
            right: 5
          });
        }
      }
    },
    parent: {
      object: '<li />',
      selector: 'li',
      css: {}
    },
    css: {
      display: 'none',
      width: '310px'
    },
    addClass: ''
  };
})(jQuery);
