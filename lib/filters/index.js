'use strict';

var walkSync = require('fs-tools').walkSync;

module.exports = function loadFilters(N) {
  walkSync(__dirname, /\.js$/, function(fileName) {
    require(fileName);
  });
};
