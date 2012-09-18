"use strict";


/*global nodeca, _*/


var NLib  = require('nlib');
var Async = NLib.Vendor.Async;


////////////////////////////////////////////////////////////////////////////////


module.exports.parserParameters = {
  version:      nodeca.runtime.version,
  addHelp:      true,
  help:         'list registeres filters',
  description:  'List registered filters'
};

module.exports.commandLineArguments = [
  {
    args:     [ '--api-path' ],
    options: {
      dest:         'apiPaths',
      help:         'Limit output list to the given API path only',
      action:       'append',
      defaultValue: []
    }
  }
];


module.exports.run = function (args, callback) {
  Async.series([
    require('../lib/init/redis'),
    require('../lib/init/mongoose'),
    NLib.InitStages.loadModels,
    NLib.InitStages.loadServerApiSubtree
  ], function (err) {
    if (err) {
      callback(err);
      return;
    }

    function skipApiPath(apiPath) {
      return args.apiPaths.length && !_.include(args.apiPaths, apiPath || 'global');
    }

    _.each(nodeca.filters.__hooks__, function (hooks, apiPath) {
      if (skipApiPath(apiPath)) {
        return;
      }

      console.log('\n');
      console.log(apiPath || '<GLOBAL>');

      ['before', 'after', 'ensure'].forEach(function (chain) {
        if (!nodeca.filters.__hooks__[apiPath][chain].sorted.length) {
          return;
        }

        console.log('  *** ' + chain + ':');

        _.each(nodeca.filters.__hooks__[apiPath][chain].__sequences__, function (filters, prio) {
          _.each(filters, function (filter) {
            console.log('   ' + prio + ' ' + (filter.func.name || '<anonymous>'));

            if (filter.exclude.length) {
              console.log('    excluding:');
              console.log('    - ' + filter.exclude.join('\n    - '));
            }
          });
        });
      });
    });

    console.log('\n');
    process.exit(0);
  });
};
