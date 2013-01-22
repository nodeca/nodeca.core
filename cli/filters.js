"use strict";


var _ = require('underscore');
var async = require("async");


////////////////////////////////////////////////////////////////////////////////


// callback for Array#sort to sort numbers adequately :))
function sort_nums_asc(a, b) {
  return a - b;
}


////////////////////////////////////////////////////////////////////////////////


module.exports.parserParameters = {
  addHelp:      true,
  help:         'list registeres filters',
  description:  'List registered filters'
};


module.exports.commandLineArguments = [
  {
    args:     [ '-m', '--mask' ],
    options: {
      dest:   'mask',
      help:   'Limit output list to the given pattern only (search by substring)',
      type:   'string',
      defaultValue: []
    }
  },

  {
    args:     [ '-s', '--short' ],
    options: {
      dest:   'short',
      help:   'Limit output list to the given API path only',
      action: 'storeTrue'
    }
  }

];


module.exports.run = function (N, args, callback) {

  async.series(
    _.map([
      require('../lib/system/init/redis'),
      require('../lib/system/init/mongoose'),
      require('../lib/system/init/models'),
      // bundle loads server
      require('../lib/system/init/bundle')
    ], function (fn) { return async.apply(fn, N); })

    , function (err) {
      if (err) {
        callback(err);
        return;
      }

      function skipApiPath(apiPath) {
        return args.apiPaths.length && !_.include(args.apiPaths, apiPath || 'global');
      }

      console.log('\n');

      _.each(N.wire.stat(), function (hook) {
        // try to filter by pattern, if set
        if (args.mask && (-1 === hook.name.indexOf(args.mask))) {
          return;
        }

        if (args.short) {
          // short formst
          console.log('- ' + hook.name);
        } else {
          // long format
          console.log('\n' + hook.name + ' -->\n');
          _.each(hook.listeners, function (handler) {
            console.log(
              '  - ' + (handler.func.name || "<anonymous>") +
              '        prio: ' + handler.priority + ',  cnt: ' + handler.ncalled +
              (handler.ensure ? ',  permanent' : '')
            );
          });
        }
      });

      console.log('\n');
      process.exit(0);
    }
  );
};
