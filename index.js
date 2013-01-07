"use strict";

exports.root = __dirname;
exports.name = 'nodeca.core';
exports.init = function () {
  require('./lib/filters');
};
