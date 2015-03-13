'use strict';


// Put client timezone into cookies to properly correct time on generated pages
//
N.wire.once('navigate.done', function timezone_store() {
  var tz = new Date().getTimezoneOffset();
  document.cookie = 'tz=' + tz + '; path=/; ' + new Date(0x7fffffff * 1e3);
});
