'use strict';


var _ = require('lodash');


var memoisedScrollPos = 0;
var MIN_TRACKED_OFFS  = 50;


function hideMenu() {
  $('.layout__container').removeClass('nav-panel__menu-active');
}

function hideScrollback() {
  memoisedScrollPos = 0;
  $('.layout__container').removeClass('nav-panel__scrollback-active');
}


// reset states on page leave
N.wire.on('navigate.to', function () {
  hideMenu();
  hideScrollback();
});


N.wire.on('common.blocks.nav_panel.toggle_menu', function () {
  $('.layout__container').toggleClass('nav-panel__menu-active');
});


// Disable 'scroll back' if user started scrolling manually
var trackScrollPos = _.throttle(function() {
  if ($(window).scrollTop() < MIN_TRACKED_OFFS) { return; }

  $(window).off('scroll', trackScrollPos);
  hideScrollback();
}, 100);


N.wire.on('common.blocks.nav_panel.scroll', function () {
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
    scrollTop:  0
  , scrollLeft: 0
  }, 300, function () {
    // Install scroll position tracker
    if (memoisedScrollPos) {
      $('.layout__container').addClass('nav-panel__scrollback-active');
      $(window).scroll(trackScrollPos);
    }
  });
});
