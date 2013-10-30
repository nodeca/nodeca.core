// When page is loaded at first time (via http), lasy load images on scroll
//

'use strict';

N.wire.once('navigate.done', { priority: 100}, function () {

  // Mobify can be missed - it's not loaded for old browsers. Should check that exists
  if (window.Mobify && window.Mobify.Lazyload) {
    window.Mobify.$ = window.jQuery;
    window.Mobify.Lazyload.attachLazyloadEvents();
  }

});
