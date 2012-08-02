'use strict';


/**
 *  client
 **/

/**
 *  client.common
 **/

/**
 *  client.common.controlbar
 **/


/*global $, _, nodeca, window, document*/


/**
 *  client.common.controlbar.init()
 *
 *  Assigns all necessary event listeners and handlers.
 *
 *
 *  ##### Example
 *
 *      nodeca.client.common.controlbar.init();
 **/
module.exports.init = function () {
  $(function () {
    // fix sub nav on scroll
    var $win = $(window),
        $nav = $('.controlbar'),
        navTop = $('.controlbar').length && $('.controlbar').offset().top,
        isFixed = 0;

    function processScroll() {
      var i, scrollTop = $win.scrollTop();

      if (scrollTop >= navTop && !isFixed) {
        isFixed = 1;
        $nav.addClass('controlbar-fixed');
        return;
      }

      if (scrollTop <= navTop && isFixed) {
        isFixed = 0;
        $nav.removeClass('controlbar-fixed');
        return;
      }
    }

    processScroll();

    $win.on('scroll', processScroll);

    // hack sad times - holdover until rewrite for 2.1
    $nav.on('click', function () {
      if (!isFixed) {
        setTimeout(function () {
          $win.scrollTop($win.scrollTop() - 47);
        }, 10);
      }
    });
  });
};
