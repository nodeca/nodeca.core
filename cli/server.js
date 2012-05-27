"use strict";


/*global nodeca*/

// nodeca
var NLib = require('nlib');

var Async = NLib.Vendor.Async;

module.exports.parserParameters= {
  version: nodeca.runtime.version,
  addHelp:true,
  help: 'start nodeca server',
  description: 'Start nodeca server'
};

module.exports.commandLineArguments = [];

module.exports.run = function (args, callback) {
  Async.series([
    require('../lib/init/redis'),
    require('../lib/init/mongoose'),

    NLib.init.loadModels,
    NLib.init.loadServerApiSubtree,
    NLib.init.loadSharedApiSubtree,
    NLib.init.loadClientApiSubtree,
    NLib.init.loadSettings,
    NLib.init.initTranslations,
    NLib.init.buildBundles,

    require('../lib/init/assets'),

    NLib.init.initRouter,

    require('../lib/init/migrations_check'),
    require('../lib/init/server'),
    require('../lib/init/filters')
  ], callback);
};
