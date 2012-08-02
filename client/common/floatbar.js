'use strict';


/**
 *  client
 **/

/**
 *  client.common
 **/

/**
 *  client.common.floatbar
 **/


/*global $, _, nodeca, window, document*/


/**
 *  client.common.floatbar.init()
 *
 *  Assigns all necessary event listeners and handlers.
 *
 *
 *  ##### Example
 *
 *      nodeca.client.common.floatbar.init();
 **/
module.exports.init = function () {
  $(function () {
    // fix sub nav on scroll
    var $win = $(window), $bar = $('#floatbar');

    // remove previous floatbar handlers (if any)
    $win.off('.floatbar');

    if (!$bar.length) {
      // do nothing if there's no floatbar
      return;
    }

    var navTop = $bar.offset().top, isFixed = false;

    function updateFloatbarState() {
      var i, scrollTop = $win.scrollTop();

      if (scrollTop >= navTop && !isFixed) {
        isFixed = true;
        $bar.addClass('floatbar-fixed');
        return;
      }

      if (scrollTop <= navTop && isFixed) {
        isFixed = false;
        $bar.removeClass('floatbar-fixed');
        return;
      }
    }

    updateFloatbarState();

    $win.on('scroll.floatbar', _.throttle(updateFloatbarState, 100));
  });
};
