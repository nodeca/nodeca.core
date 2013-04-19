'use strict';


var _ = require('lodash');


var floatbarUid = null
  , offsetTop
  , isFixed;


N.wire.on('navigate.done', function () {
  var $window   = $(window)
    , $floatbar = $('#floatbar');

  if (0 === $floatbar.length) {
    // Do nothing if there's no floatbar.
    return;
  }

  // offsetTop should be calculated only once, on first page load.
  // If content is added with "More" button, offset should not be changed.
  if (!floatbarUid || floatbarUid !== $floatbar.data('floatbarUid')) {
    floatbarUid = String(Date.now());
    $floatbar.data('floatbarUid', floatbarUid);

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
