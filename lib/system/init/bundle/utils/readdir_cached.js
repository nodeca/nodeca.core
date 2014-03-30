'use strict';

var _       = require('lodash');
var fs      = require('fs');
var path    = require('path');

var readdir_cached = _.memoize(function(dirPath) {
  return fs.readdirSync(dirPath);
});

module.exports = function (dirPath) {
  return readdir_cached(path.resolve(dirPath));
};