'use strict';

var walkSync = require('fs-tools').walkSync;
var path = require('path');

module.exports = function loadFilters(N) {
  walkSync(path.join(__dirname, 'hooks'), /\.js$/, function(fileName, stat) {
    if (stat.isFile()) {
      require(fileName)(N);
    }
  });
};