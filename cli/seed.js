"use strict";


/*global nodeca*/

var Path = require('path');

// nodeca
var NLib = require('nlib');

var Async = NLib.Vendor.Async;
var FsTools = NLib.Vendor.FsTools;

var SEEDS_DIR = 'db/seeds';

function get_app_path(app_name){
  for (var i=0; i < nodeca.runtime.apps.length; i++) {
    if (app_name === nodeca.runtime.apps[i].name){
      return nodeca.runtime.apps[i].root;
    }
  }
  return null;
}

module.exports.parserParameters= {
  addHelp:true,
  description: 'That will run `.<app_name>/db/seeds/<seed_name>.js` if exists. ' +
    'Or, all seeds from `./db/seeds/seed-name/` folder. If <seed-name>' +
    'missed, then script will show all available seeds for given app. ' +
    'If `-a` missed, then all seed for all apps will be shown.',
  epilog: 'Note: Loading seeds is limited to development/test enviroment.' +
    'If you really need to run seed  on production/stageing, use ' +
    'option -f.',
  help: 'show or run existing seeds'
};

module.exports.commandLineArguments = [
  {
    args: ['-f'],
    options: {
      help:'run without env checking',
      action: 'storeTrue'
    }
  },
  {
    args: ['-a', '--app'],
    options: {
      help: 'application name',
      type: 'string'
    }
  },
  {
    args: ['seed'],
    options: {
      metavar: 'SEED_NAME',
      help:'seed name',
      nargs:'?',
      defaultValue:null
    }
  },
];

module.exports.run = function (args, callback) {
  var app_name = args.app;
  var seed_name = args.seed;
  Async.series([
    require('../lib/init/redis'),
    require('../lib/init/mongoose'),
    NLib.init.loadModels,
  ], function (err) {
    if (err){
      callback(err);
    }

    // execute seed
    if (!!app_name && !!seed_name){
      var env = nodeca.runtime.env;
      if ('development' !== env && 'testing' !== env && !args.force) {
        console.log('Error: Can\'t run seed from ' + env + ' enviroment. Please, use -f to force.');
        process.exit(1);
      }

      var seed_path = Path.join(get_app_path(app_name), SEEDS_DIR, seed_name);
      if (!Path.existsSync(seed_path)){
        console.log('Error: Application "' + app_name + '"does not have "' + seed_name);
        process.exit(1);
      }

      require(seed_path)(function(err){
        if (err) {
          callback(err);
        }
        process.exit(0);
      });
    }
    else {
      var apps;
      if (app_name) {
        apps = [{name: app_name, root: get_app_path(app_name)}];
      }
      else {
        apps = nodeca.runtime.apps;
      }

      console.log('Avaliable seeds:');

      Async.forEachSeries(apps, function(app, next_app){
        var seed_dir = Path.join(app.root, SEEDS_DIR);
        FsTools.walk(seed_dir, /w*\.js$/, function(file, stats, next_file) {
          console.log('  ' + app.name + ':' + Path.basename(file));
          next_file();
        }, next_app);
      }, function(err){
        if (err) {
          callback(err);
        }
        process.exit(0);
      });
    }
  });
};
