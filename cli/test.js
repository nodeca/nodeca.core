"use strict";


/*global N, underscore*/


// stdlib
var fs        = require('fs');
var path      = require('path');


// 3rd-party
var _         = underscore;
var chai      = require('chai');
var async     = require('async');
var Mocha     = require('mocha');
var fstools   = require('fs-tools');


////////////////////////////////////////////////////////////////////////////////


chai.should();


////////////////////////////////////////////////////////////////////////////////


module.exports.parserParameters = {
  version: N.runtime.version,
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


module.exports.run = function (args, callback) {
  if (!process.env.NODECA_ENV) {
    callback("You must provide NODECA_ENV in order to run nodeca test");
    return;
  }

  async.series([
    require('../lib/system/init/redis'),
    require('../lib/system/init/mongoose'),
    require('../lib/system/init/models'),
    require('../lib/system/init/stores'),
    require('../lib/system/init/check_migrations'),
    require('../lib/system/init/bundle'),
    // router needs to go after bundle,
    // as server tree got polluted in bundle
    require('../lib/system/init/router'),

    function (next) {
      var mocha = new Mocha();

      mocha.reporter('spec');
      mocha.ui('bdd');

      _.each(N.runtime.apps, function (app) {
        if (!args.app || args.app === app.name) {
          fstools.walkSync(app.root + '/test', function (file) {
            if ((/\.js$/).test(file) && '.' !== path.basename(file)[0]) {
              mocha.files.push(file);
            }
          });
        }
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
