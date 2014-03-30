'use strict';

var _       = require('lodash');
var fs      = require('fs');
var path    = require('path');

var stat_cached = _.memoize(function(filePath) {
  return fs.statSync(filePath);
});

module.exports = function statCached(filePath) {
  return stat_cached(path.resolve(filePath));
};