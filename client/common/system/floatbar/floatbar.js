'use strict';


var _ = require('lodash');


N.wire.on('navigate.done', function () {
  var $window   = $(window)
    , $floatbar = $('#floatbar')
    , isFixed   = false
    , navTop;

  // Remove previous floatbar handlers if any.
  $window.off('scroll.floatbar');

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
