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

module.exports.run = function (args, callback) {
  Async.series([
    require('../lib/init/redis'),
    require('../lib/init/mongoose'),

    NLib.init.loadModels,

    require('../lib/init/migrations_check'),

    NLib.init.loadServerApiSubtree,
    NLib.init.loadSharedApiSubtree,
    NLib.init.loadClientApiSubtree,
    NLib.init.loadSettings,
    NLib.init.initRouter,

    NLib.init.initTranslations,

    require('../lib/init/assets'),
    require('../lib/init/server')
  ], callback);
};
