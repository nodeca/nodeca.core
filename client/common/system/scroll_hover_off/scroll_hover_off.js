// Disable pointer events on scroll to block hover effects.
// http://www.thecssninja.com/javascript/pointer-events-60fps
//
// Remove if side-effects found.
//


'use strict';


var root = document.documentElement;
var timer;

window.addEventListener('scroll', function() {

  clearTimeout(timer);

  if (!root.style.pointerEvents) {
    root.style.pointerEvents = 'none';
  }

  timer = setTimeout(function() {
    root.style.pointerEvents = '';
  }, 100);

}, false);