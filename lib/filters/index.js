'use strict';


// stdlib
var path  = require('path');
var fs    = require('fs');


////////////////////////////////////////////////////////////////////////////////


function requireRecursive(dirname) {
  fs.readdirSync(dirname).forEach(function (filename) {
    filename = path.join(dirname, filename);

    if (fs.statSync(filename).isDirectory()) {
      requireRecursive(filename);
      return;
    }

    if (__filename !== filename && '.js' === path.extname(filename)) {
      require(filename);
    }
  });
}


////////////////////////////////////////////////////////////////////////////////


requireRecursive(__dirname);
