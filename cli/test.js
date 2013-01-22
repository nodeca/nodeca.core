"use strict";


// stdlib
var path      = require('path');


// 3rd-party
var _         = require('underscore');
var chai      = require('chai');
var async     = require('async');
var Mocha     = require('mocha');
var fstools   = require('fs-tools');


////////////////////////////////////////////////////////////////////////////////


chai.should();


////////////////////////////////////////////////////////////////////////////////


module.exports.parserParameters = {
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


module.exports.run = function (N, args, callback) {
  if (!process.env.NODECA_ENV) {
    callback("You must provide NODECA_ENV in order to run nodeca test");
    return;
  }

  async.series(
    _.map([
      require('../lib/system/init/redis'),
      require('../lib/system/init/mongoose'),
      require('../lib/system/init/models'),
      require('../lib/system/init/stores'),
      require('../lib/system/init/check_migrations'),
      require('../lib/system/init/bundle')
    ], function (fn) { return async.apply(fn, N); })

    , function (err) {
      if (err) {
        callback(err);
        return;
      }

      var mocha = new Mocha();
      var applications = N.runtime.apps;

      mocha.reporter('spec');
      mocha.ui('bdd');

      // if app set, chack that it's valid
      if (args.app) {
        if (!_.find(applications, function (app) { return app.name === args.app; })) {
          console.log('Invalid application name: ' + args.app);
          console.log(
            'Valid apps are:  ',
             _.map(applications, function (app) { return app.name; }).join(', ')
          );
          process.exit(1);
        }
      }

      _.each(applications, function (app) {
        if (!args.app || args.app === app.name) {
          fstools.walkSync(app.root + '/test', function (file) {
            if ((/\.js$/).test(file) && '.' !== path.basename(file)[0]) {
              mocha.files.push(file);
            }
          });
        }
      });

      mocha.run(function (err) {
        if (err) {
          callback(err);
          return;
        }

        process.exit(0);
      });
    }
  );
};
