"use strict";


// nodeca
var NLib = require('nlib');


module.exports = NLib.Application.create({
  root: __dirname,
  name: 'nodeca.core',
  bootstrap: function (nodeca, callback) {
    // empty bootstrap... for now..
    callback();
  }
});


//
// Register filters
//


require('./lib/filters');


//
// Preinitialize some base structures
//


require('./lib/io');
require('./lib/components');
