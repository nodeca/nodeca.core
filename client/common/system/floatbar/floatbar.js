'use strict';


var _ = require('lodash');


var controlTimestamp = null
  , offsetTop
  , isFixed;


N.wire.on('navigate.done', function () {
  var $window   = $(window)
    , $floatbar = $('#floatbar');

  if (0 === $floatbar.length) {
    // Do nothing if there's no floatbar.
    return;
  }

  // Initialize at first time.
  if (!controlTimestamp || controlTimestamp !== $floatbar.data('controlTimestamp')) {
    controlTimestamp = String(Date.now());
    $floatbar.data('controlTimestamp', controlTimestamp);

    offsetTop = $floatbar.offset().top;
    isFixed   = false;
  }

  function updateFloatbarState() {
    var scrollTop = $window.scrollTop();

    if (scrollTop >= offsetTop && !isFixed) {
      isFixed = true;
      $floatbar.addClass('floatbar-fixed');

    } else if (scrollTop <= offsetTop && isFixed) {
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
});
