'use strict';


var _ = require('lodash');


N.wire.on('navigate.done', function () {
  var $window   = $(window)
    , $floatbar = $('#floatbar')
    , isFixed   = false
    , navTop;

  if (0 === $floatbar.length) {
    // Do nothing if there's no floatbar.
    return;
  }

  navTop  = $floatbar.offset().top;
  isFixed = false;

  function updateFloatbarState() {
    var scrollTop = $window.scrollTop();

    if (scrollTop >= navTop && !isFixed) {
      isFixed = true;
      $floatbar.addClass('floatbar-fixed');

    } else if (scrollTop <= navTop && isFixed) {
      isFixed = false;
      $floatbar.removeClass('floatbar-fixed');
    }
  }

  updateFloatbarState();

  $window.on('scroll.floatbar', _.throttle(updateFloatbarState, 100));
});


N.wire.on('navigate.exit', function () {
  // Remove floatbar event handler.
  $(window).off('scroll.floatbar');

  // Get floatbar back to the initial position to ensure next `navigate.done`
  // handler will obtain correct floatbar offset on next call.
  $('#floatbar').removeClass('floatbar-fixed');
});
