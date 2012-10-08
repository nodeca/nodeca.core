"use strict";


/*global nodeca*/

// nodeca
var NLib = require('nlib');

var Async = NLib.Vendor.Async;

module.exports.parserParameters = {
  version: nodeca.runtime.version,
  addHelp: true,
  help: 'start nodeca server',
  description: 'Start nodeca server'
};

module.exports.run = function (args, callback) {
  Async.series([
    require('../lib/init/redis'),
    require('../lib/init/mongoose'),

    NLib.InitStages.loadModels,

    require('../lib/init/migrations_check'),

    NLib.InitStages.loadServerApiSubtree,
    NLib.InitStages.loadSharedApiSubtree,
    NLib.InitStages.loadClientApiSubtree,
    NLib.InitStages.loadSettings,
    NLib.InitStages.initRouter,

    NLib.InitStages.initTranslations,

    require('../lib/init/assets'),
    require('../lib/init/server')
  ], callback);
};
