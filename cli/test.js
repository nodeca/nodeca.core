"use strict";


/*global nodeca, _*/


// stdlib
var fs        = require('fs');
var path      = require('path');
var resolve   = path.resolve;
var exists    = fs.existsSync || path.existsSync;
var join      = path.join;
var basename  = path.basename;


// 3rd-party
var NLib      = require('nlib');
var Async     = require('nlib').Vendor.Async;
var Mocha     = require('mocha');


////////////////////////////////////////////////////////////////////////////////


module.exports.parserParameters = {
  version: nodeca.runtime.version,
  addHelp: true,
  help: 'run test suites',
  description: 'Run all tests of enabled apps'
};


module.exports.commandLineArguments = [
  {
    args: ['app'],
    options: {
      metavar: 'APP_NAME',
      help: 'Run tests of specific application only',
      nargs: '?',
      defaultValue: null
    }
  }
];


////////////////////////////////////////////////////////////////////////////////


require('should');


nodeca.runtime.env = process.env.NODECA_ENV || 'test';


// Lookup file names at the given `path`.
//
function lookupFiles(path, recursive) {
  var files = [], stat;

  if (!exists(path)) {
    path += '.js';
  }

  try {
    stat = fs.statSync(path);
  } catch (err) {
    return files;
  }

  if (stat.isFile()) {
    return path;
  }

  fs.readdirSync(path).forEach(function(file){
    file = join(path, file);

    var stat = fs.statSync(file);

    if (stat.isDirectory()) {
      if (recursive) {
        files = files.concat(lookupFiles(file, recursive));
      }

      return;
    }

    if (!stat.isFile() || !(/\.js$/).test(file) || '.' === basename(file)[0]) {
      return;
    }

    files.push(file);
  });

  return files;
}


////////////////////////////////////////////////////////////////////////////////


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

    function (next) {
      var mocha = new Mocha(), files = [];


      mocha.reporter('spec');
      mocha.ui('bdd');

      _.each(nodeca.runtime.apps, function (app) {
        if (!args.app || args.app === app.name) {
          files = files.concat(lookupFiles(app.root + '/test', true));
        }
      });

      mocha.files = files.map(function (path) {
        return resolve(path);
      });

      mocha.run(next);
    }
  ], function (err) {
    if (err) {
      callback(err);
      return;
    }

    process.exit(0);
  });
};
