"use strict";


/*global nodeca*/

// nodeca
var NLib = require('nlib');

var Async = NLib.Vendor.Async;

module.exports.parserParameters= {
  version: nodeca.runtime.version,
  addHelp:true,
  help: 'controls nodeca server',
  description: 'Controls nodeca server ...'
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

    require('../lib/init/http_assets'),

    NLib.init.initRouter,

    require('../lib/init/migrations_check'),
    require('../lib/init/http_server'),
    require('../lib/init/filters')
  ], callback);
};
