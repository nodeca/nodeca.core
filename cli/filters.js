"use strict";


/*global N, _*/


var async = require("async");


////////////////////////////////////////////////////////////////////////////////


// callback for Array#sort to sort numbers adequately :))
function sort_nums_asc(a, b) {
  return a - b;
}


////////////////////////////////////////////////////////////////////////////////


module.exports.parserParameters = {
  version:      N.runtime.version,
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
    require('../lib/system/init/redis'),
    require('../lib/system/init/mongoose'),
    require('../lib/system/init/models'),
    // bundle loads server
    require('../lib/system/init/bundle')
  ], function (err) {
    if (err) {
      callback(err);
      return;
    }

    function skipApiPath(apiPath) {
      return args.apiPaths.length && !_.include(args.apiPaths, apiPath || 'global');
    }

    _.each(N.filters.__hooks__, function (hooks, apiPath) {
      if (skipApiPath(apiPath)) {
        return;
      }

      console.log('\n');
      console.log(apiPath || '<GLOBAL>');

      ['before', 'after', 'ensure'].forEach(function (chain) {
        var prios = Object.keys(N.filters.__hooks__[apiPath][chain].__sequences__);

        if (!prios.length) {
          return;
        }

        console.log('  *** ' + chain + ':');

        prios.sort(sort_nums_asc).forEach(function (prio) {
          _.each(N.filters.__hooks__[apiPath][chain].__sequences__[prio], function (filter) {
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
