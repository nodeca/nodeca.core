'use strict';


window.jQuery = window.$ = require('jquery');

// Polyfills
require('raf.js');
require('blueimp-canvas-to-blob');

if (!window.Promise) {
  window.Promise = require('promise-polyfill');
}

// Load kernel
N.wire = require('event-wire')();
const Pointer = require('pointer');
N.router  = new Pointer('$$ N.router.stringify() $$');

require('nodeca.core/lib/system/client/kernel.js')(N);
