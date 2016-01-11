// Run tests & exit
//

'use strict';


// stdlib
var path      = require('path');


// 3rd-party
var _            = require('lodash');
var Mocha        = require('mocha');
var navit        = require('navit');
var navitPlugins = require('nodeca.core/lib/test/navit_plugins');
var fstools      = require('fs-tools');



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
      'init:bundle_new',
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
          fstools.walkSync(app.root + '/test', function (file) {
            // skip files when
            // - filename starts with _, e.g.: /foo/bar/_baz.js
            // - dirname in path starts _, e.g. /foo/_bar/baz.js
            if (file.match(/(^|\/|\\)_/)) { return; }

            // try to filter by pattern, if set
            if (args.mask && path.basename(file).indexOf(args.mask) === -1) {
              return;
            }

            if ((/\.js$/).test(file) && path.basename(file)[0] !== '.') {
              mocha.files.push(file);
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
