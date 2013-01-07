"use strict";

exports.root = __dirname;
exports.name = 'nodeca.core';
exports.init = function () {
  require('./lib/filters');

  N.hooks.init.after('application', function (next) {
    console.dir(N.views);
    next();
  });
};
