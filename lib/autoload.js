'use strict';


const path       = require('path');
const requireAll = require('require-all');


module.exports = function loadFilters(N) {

  requireAll({
    dirname:     path.join(__dirname, 'autoload'),
    filter:      /^([^_\.].+)[.]js$/,   // skip _ and . files
    excludeDirs: /^[_\.]/,                  // skip _ and . dirs
    recursive:   true,
    resolve:     content => { content(N); return content; }
  });
};
