// Add `scroll` event handler for:
// - add modifier `hidden` to `.controlbar` element when page scrolled down
// - remove when page scrolled up
//

'use strict';

var _ = require('lodash');


// Add handler
//
N.wire.on('navigate.done', function page_setup() {
  var $controlbar = $('.controlbar');

  // If `.controlbar` not exists - don't add handler
  if (!$controlbar.length) {
    return;
  }

  var scrollBefore = 0;
  var scrollCurrent, scrollDiff;
  var $window = $(window);

  $window.on('scroll.controlbar', _.throttle(function () {
    scrollCurrent = $window.scrollTop();
    scrollDiff = scrollBefore - scrollCurrent;
    scrollBefore = scrollCurrent;

    if (scrollDiff < 0) { // scrolled down
      $controlbar.addClass('controlbar__m-hidden');
    } else if (scrollDiff > 0) { // scrolled up
      $controlbar.removeClass('controlbar__m-hidden');
    }
  }, 100));
});


// Remove handler
//
N.wire.on('navigate.exit', function page_exit() {
  $(window).off('scroll.controlbar');
});
