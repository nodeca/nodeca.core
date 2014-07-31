'use strict';


function getCookie(name) {
  var matches = document.cookie.match(new RegExp(
    '(?:^|; )' + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'
  ));
  return matches ? decodeURIComponent(matches[1]) : undefined;
}


// Toggle body class and save state in cookies on navbar style change
//
N.wire.on('common.layout.nav_toggle', function layout_toggle_navbar() {
  $('body').toggleClass('nav-vert-on').toggleClass('nav-horiz-on');

  if ($('body').hasClass('nav-vert-on')) {
    document.cookie = 'vnav=1; path=/; ' + new Date(0x7fffffff * 1e3);
  } else {
    document.cookie = 'vnav=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  }
});


// Scroll page to top
//
N.wire.on('common.layout:scroll_top', function layout_scroll_top() {
  $('html, body').animate({
    scrollTop:  0
  }, 'fast');
});


// Sync navigation style with cookie value,
// id server responded with different layout
N.wire.once('navigate.done', function layout_init() {
  if (getCookie('vnav') === '1') {
    $('body').addClass('nav-vert-on').removeClass('nav-horiz-on');
  } else {
    $('body').removeClass('nav-vert-on').addClass('nav-horiz-on');
  }
});
