"use strict";


/*global nodeca*/


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
