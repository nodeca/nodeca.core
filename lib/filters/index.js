'use strict';


var path  = require('path');
var fs    = require('fs');


////////////////////////////////////////////////////////////////////////////////


fs.readdirSync(__dirname).forEach(function (filename) {
  filename = path.join(__dirname, filename);

  if (__filename !== filename && '.js' === path.extname(filename)) {
    require(filename);
  }
});
