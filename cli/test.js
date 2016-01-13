// Run tests & exit
//

'use strict';


// stdlib
const path      = require('path');


// 3rd-party
const _            = require('lodash');
const Mocha        = require('mocha');
const navit        = require('navit');
const navitPlugins = require('nodeca.core/lib/test/navit_plugins');
const glob         = require('glob');



////////////////////////////////////////////////////////////////////////////////


module.exports.parserParameters = {
  addHelp: true,
  help: 'run test suites',
  description: 'Run all tests of enabled apps'
};


module.exports.commandLineArguments = [
  {
    args: [ 'app' ],
    options: {
      metavar: 'APP_NAME',
      help: 'Run tests of specific application only',
      nargs: '?',
      defaultValue: null
    }
  },

  {
    args:     [ '-m', '--mask' ],
    options: {
      dest:   'mask',
      help:   'Run only tests, containing MASK in name',
      type:   'string',
      defaultValue: []
    }
  }
];


////////////////////////////////////////////////////////////////////////////////


module.exports.run = function (N, args, callback) {
  if (!process.env.NODECA_ENV) {
    callback('You must provide NODECA_ENV in order to run nodeca test');
    return;
  }

  N.wire.emit([
      'init:models',
      'init:bundle',
      'init:server'
    ], N,

    function (err) {
      if (err) {
        callback(err);
        return;
      }

      var mocha = new Mocha({ timeout: 10000 });
      var applications = N.apps;

      mocha.reporter('spec');
      // mocha.ui('bdd');

      // if app set, chack that it's valid
      if (args.app) {
        if (!_.find(applications, function (app) { return app.name === args.app; })) {
          /*eslint-disable no-console*/
          console.log('Invalid application name: ' + args.app);
          console.log(
            'Valid apps are:  ',
             _.map(applications, function (app) { return app.name; }).join(', ')
          );
          N.shutdown(1);
        }
      }

      _.forEach(applications, function (app) {
        if (!args.app || args.app === app.name) {
          glob.sync('**', { cwd: app.root + '/test' })
            // skip files when
            // - filename starts with _, e.g.: /foo/bar/_baz.js
            // - dirname in path starts _, e.g. /foo/_bar/baz.js
            .filter(name => !/^[._]|\\[._]|\/[_.]/.test(name))
            .forEach(file => {
              // try to filter by pattern, if set
              if (args.mask && path.basename(file).indexOf(args.mask) === -1) {
                return;
              }

              if ((/\.js$/).test(file) && path.basename(file)[0] !== '.') {
                mocha.files.push(`${app.root}/test/${file}`);
              }
            });
        }
      });

      // Expose N to globals for tests
      global.TEST = {
        N: N,
        browser: navit().use(navitPlugins)
      };

      mocha.run(function (err) {
        if (err) {
          callback(err);
          return;
        }

        N.shutdown();
      });
    }
  );
};
