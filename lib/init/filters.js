"use strict";


// stdlib
var fs    = require('fs');
var path  = require('path');


////////////////////////////////////////////////////////////////////////////////


fs.readdirSync(path.join(__dirname, 'filters')).forEach(function (file) {
  require(path.join(__dirname, 'filters', file));
});
