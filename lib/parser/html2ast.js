'use strict';

var $ = require('./cheequery');

module.exports = function (data, callback) {

  data.output = $.load(data.input);

  // TODO
  callback();
};
