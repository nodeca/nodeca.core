'use strict';


// Put client timezone into cookies to properly display time on generated pages
// (needed for server side rendering only).
//
N.wire.once('navigate.done', function timezone_store() {
  var pairs = [];

  pairs.push('tz=' + new Date().getTimezoneOffset());
  pairs.push('path=/');
  pairs.push('max-age=' + 3600 * 24 * 365);
  pairs.push('SameSite=Lax');

  if (location.protocol === 'https:') pairs.push('secure');

  document.cookie = pairs.join('; ');
});
