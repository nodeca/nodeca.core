// Main application initializer. Executed as the most first step of the
// `cli/server.js` and does following:
//
//  - fetches all bin files of all packages
//  - compiles styles client trees for all packages
//  - find and read all viewws
//  - find and prepare all server methods
//  - prepares bundles client js files for all packages containing:
//    - i18n of the package
//    - client methods
//    - server methods wrapers
//    - views
//  - output bundled files into the `public/assets` dir
//  - initialize router


'use strict';


// stdlib
var fs = require('fs');


// 3rd-party
var async   = require('async');
var fstools = require('fs-tools');


// internal
var stopwatch     = require('./utils/stopwatch');
var readPkgConfig = require('./bundle/utils/read_pkg_config');


////////////////////////////////////////////////////////////////////////////////


module.exports = function (N, callback) {
  var timer = stopwatch();

  N.wire.on("init:bundle", function bundle_all(N, next) {
    var tmpdir;

    // schedule files cleanup upon normal exit
    process.on('exit', function (code) {
      if (0 !== +code) {
        console.warn("Unclean exit. Bundled files left in '" + tmpdir + "'");
        return;
      }

      try {
        console.warn("Removing '" + tmpdir + "'...");
        fstools.removeSync(tmpdir);
      } catch (err) {
        console.warn("Failed remove '" + tmpdir + "'... " + String(err));
      }
    });

    try {
      // create temporary dir for styles
      tmpdir = fstools.tmpdir();
      fs.mkdirSync(tmpdir);
    } catch (err) {
      next(err);
      return;
    }

    readPkgConfig(N.runtime.apps, function (err, config) {
      var sandbox = {};

      if (err) {
        next(err);
        return;
      }

      sandbox.config = config;

      async.series([
        async.apply(require('./bundle/mincer'),    tmpdir, sandbox),
        async.apply(require('./bundle/bin'),       tmpdir, sandbox),
        async.apply(require('./bundle/styles'),    tmpdir, sandbox),
        async.apply(require('./bundle/i18n'),      tmpdir, sandbox),
        async.apply(require('./bundle/views'),     tmpdir, sandbox),
        async.apply(require('./bundle/client'),    tmpdir, sandbox),
        async.apply(require('./bundle/server'),    tmpdir, sandbox),
        async.apply(require('./bundle/router'),    tmpdir, sandbox),
        async.apply(require('./bundle/compile'),   tmpdir, sandbox),
        async.apply(require('./bundle/manifest'),  tmpdir, sandbox)
      ], function (err) {
        if (err) {
          next(err);
          return;
        }

        N.logger.info('Finish bundle init ' + timer.elapsed);
        next();
      });
    });
  });

  N.wire.emit('init:bundle', N, callback);
};
