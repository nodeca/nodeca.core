'use strict';


/**
 *  client
 **/

/**
 *  client.common
 **/


/*global $, _, nodeca, window, document*/


/**
 *  client.common.init()
 *
 *  Assigns all necessary event listeners and handlers.
 *
 *
 *  ##### Example
 *
 *      nodeca.client.common.init();
 **/
module.exports = function () {
  nodeca.io.init();


  $(function () {
    // Bootstrap.Collapse calls e.preventDefault() only when there's no
    // data-target attribute. We don't want URL to be changed, so we are
    // forcing prevention of default behavior.
    $('body').on('click.collapse.data-api', '[data-toggle=collapse]', function (e) {
      e.preventDefault();
    });

    //
    // Observe quicksearch focus to tweak icon style
    //

    $('.navbar-search .search-query')
      .focus(function (){ $(this).next('div').addClass('focused'); })
      .blur(function (){ $(this).next('div').removeClass('focused'); });
  });


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


  // assign action links handlers
  nodeca.client.common.init.action_links();


  // history intercepts clicks on all `a` elements,
  // so we initialize it as later as possible to have
  // "lowest" priority of handlers
  nodeca.client.common.init.history();
};
