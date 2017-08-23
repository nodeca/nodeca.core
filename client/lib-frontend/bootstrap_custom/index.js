'use strict';

// dependency for bootstrap tooltips
// (it actually requires window.Tether)
//
window.Tether = require('tether');

// dependency for bootstrap dropdown
//
window.Popper = require('popper.js');

// require compiled bootstrap file because we have
// no access to source files in npm package, see:
// https://github.com/twbs/bootstrap/issues/18934
//
require('bootstrap/dist/js/bootstrap.js');

/*
//require('bootstrap/js/src/alert');
//require('bootstrap/js/src/button');
//require('bootstrap/js/src/carousel');
require('bootstrap/js/src/collapse');
require('bootstrap/js/src/dropdown');
require('bootstrap/js/src/modal');
//require('bootstrap/js/src/scrollspy');
require('bootstrap/js/src/tab');
//require('bootstrap/js/src/tooltip');
require('bootstrap/js/src/util');

// Popover must go AFTER tooltip
//require('bootstrap/js/src/popover');
*/
