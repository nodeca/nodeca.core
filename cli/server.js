"use strict";



var _ = require('underscore');
var async = require('async');


module.exports.parserParameters = {
  addHelp:      true,
  help:         'start nodeca server',
  description:  'Start nodeca server'
};


module.exports.commandLineArguments = [
  {
    args: ['--test'],
    options: {
      help:   'Start server an terminates immediately, ' +
              'with code 0 on init success.',
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
      require('../lib/system/init/stores'),
      require('../lib/system/init/check_migrations'),
      require('../lib/system/init/bundle'),
      require('../lib/system/init/server')
    ], function (fn) { return async.apply(fn, N); })

    , function (err) {
      if (err) {
        callback(err);
        return;
      }

      // for `--test` just exit on success
      if (args.test) {
        process.stdout.write('Server exec test OK\n');
        process.exit(0);
      }

      callback();
    }
  );
};
