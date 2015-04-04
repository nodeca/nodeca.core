// - Vertical site navigation logic
// - Needs external '.layout__container' wrapper
'use strict';


var _ = require('lodash');


var memoisedScrollPos = 0;
var MIN_TRACKED_OFFS  = 50;


function hideMenu() {
  $('.layout__container').removeClass('nav-vert__menu-active');
}

function hideScrollback() {
  memoisedScrollPos = 0;
  $('.layout__container').removeClass('nav-vert__scrollback-active');
}


// reset states on page leave
N.wire.on('navigate.to', function nav_vert_init() {
  hideMenu();
  hideScrollback();
});


N.wire.on('common.blocks.nav_vert.toggle_menu', function nav_vert_toggle_menu() {
  $('.layout__container').toggleClass('nav-vert__menu-active');
});


// Disable 'scroll back' if user started scrolling manually
var trackScrollPos = _.throttle(function () {
  if ($(window).scrollTop() < MIN_TRACKED_OFFS) { return; }

  $(window).off('scroll', trackScrollPos);
  hideScrollback();
}, 100);


// Scroll to top or back on button press
//
N.wire.on('common.blocks.nav_vert.scroll', function nav_vert_scroll() {
  hideMenu();

  if (memoisedScrollPos) {
    // 'scroll back' pressed
    $('html:not(:animated), body:not(:animated)').animate({
      scrollTop: memoisedScrollPos
    }, 300, hideScrollback);
    return;
  }

  // 'scroll top' pressed
  var scrollTop = $(window).scrollTop();
  memoisedScrollPos = (scrollTop > MIN_TRACKED_OFFS) ? scrollTop : 0;

  $('html:not(:animated), body:not(:animated)').animate({
    scrollTop:  0,
    scrollLeft: 0
  }, 300, function () {
    // Install scroll position tracker
    if (memoisedScrollPos) {
      $('.layout__container').addClass('nav-vert__scrollback-active');
      $(window).scroll(trackScrollPos);
    }
  });
});


// Update "active" tab of the navbar_menu when moving to another page.
//
N.wire.on('navigate.done', function navbar_menu_change_active(target) {
  var targetPath = target.apiPath.split('.'), tabs, active;

  tabs = $('.nav-vert__overlay').find('[data-api-path]');
  tabs.removeClass('active');

  // Select the most specific tab - with the longest API path match.
  active = _.max(tabs, function (tab) {
    var tabPath = $(tab).data('apiPath').split('.'),
        index   = -1,
        length  = Math.min(tabPath.length, targetPath.length);

    do { index += 1; }
    while (index < length && tabPath[index] === targetPath[index]);

    return index;
  });

  // if autoselection not disabled - add highlighting class
  if ($(active).data('autoselect') !== 0) {
    $(active).addClass('active');
  }
});
