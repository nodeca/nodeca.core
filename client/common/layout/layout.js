'use strict';


function getCookie(name) {
  var matches = document.cookie.match(new RegExp(
    '(?:^|; )' + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'
  ));
  return matches ? decodeURIComponent(matches[1]) : undefined;
}


N.wire.on('common.layout.nav_toggle', function () {
  $('body').toggleClass('nav-vert-on').toggleClass('nav-horiz-on');

  if ($('body').hasClass('nav-vert-on')) {
    document.cookie = 'vnav=1; ' + new Date(0x7fffffff * 1e3);
  } else {
    document.cookie = 'vnav=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  }
});


// Sync navigation style with cookie value,
// id server responded with different layout
N.wire.once('navigate.done', function () {
  if (getCookie('vnav') === '1') {
    $('body').addClass('nav-vert-on').removeClass('nav-horiz-on');
  } else {
    $('body').removeClass('nav-vert-on').addClass('nav-horiz-on');
  }
});
