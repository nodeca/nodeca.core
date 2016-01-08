'use strict';

exports.root = __dirname;
exports.name = 'nodeca.core';
exports.init = N => require('./lib/autoload.js')(N);
exports.run  = root_app => require('./lib/system/runner').bootstrap(root_app);
