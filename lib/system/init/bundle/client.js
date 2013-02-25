// `client` section processor
//


'use strict';


// stdlib
var fs    = require('fs');
var path  = require('path');


// 3rd-party
var _       = require('lodash');
var async   = require('async');
var ejs     = require('ejs');
var fstools = require('fs-tools');


// internal
var stopwatch = require('../utils/stopwatch');


////////////////////////////////////////////////////////////////////////////////


var TEMPLATE = fs.readFileSync(path.join(__dirname, 'client', 'template.js.ejs'), 'utf8');


////////////////////////////////////////////////////////////////////////////////


function browserify(files, destination) {
  fstools.mkdirSync(path.dirname(destination));

  // Create an empty file if any.
  fs.writeFileSync(destination, '', 'utf8');

  _.each(files, function (pathname) {
    var result = ejs.render(TEMPLATE, {
      name:    JSON.stringify(pathname.toString())
    , apiPath: JSON.stringify(pathname.apiPath)
    , root:    JSON.stringify(pathname.dirname)
    , source:  pathname.readSync()
    });

    fs.appendFileSync(destination, result, 'utf8');
  });

  _.each(files, function (pathname) {
    fs.appendFileSync(destination, ('require(' + JSON.stringify(pathname.toString()) + ');\n'), 'utf8');
  });
}


////////////////////////////////////////////////////////////////////////////////


module.exports = function (sandbox, callback) {
  var timer = stopwatch()
    , N = sandbox.N
    , tmpdir = sandbox.tmpdir;

  async.forEachSeries(_.keys(sandbox.config.packages), function (pkgName, next) {
    var
    clientConfig      = sandbox.config.packages[pkgName].client,
    // final file (contains client tree and main file)
    clientOutfile     = path.join(tmpdir, 'client', pkgName + '.js'),
    // isolated directory with client tree
    clientTmpTreedir  = path.join(tmpdir, 'client', pkgName),
    // client tree
    clientTmpTreefile = path.join(clientTmpTreedir, 'client.js'),
    // per-package timer
    timer             = stopwatch(),
    // if config has "main file", respect it, otherwise use client tree only
    mainFile,
    // get existing mincer environment
    environment       = sandbox.assets.environment,
    // get current paths list, to restore it later
    envPaths          = environment.paths;

    if (!clientConfig) {
      next();
      return;
    }

    try {
      browserify(clientConfig.files, clientTmpTreefile);
      mainFile = String(clientConfig.main || clientTmpTreefile);
    } catch (err) {
      next(err);
      return;
    }

    // we need to prepend path with client tree to allow use
    //
    //    //= require client
    //
    // in main file
    environment.prependPath(clientTmpTreedir);

    // When Mincer is asked for a main file, it must be within roots, that
    // Mincer knows about. See: https://github.com/nodeca/mincer/issues/51
    clientConfig.lookup.forEach(function (options) {
      environment.appendPath(options.root);
    });

    //
    // check that main file is requirable
    //

    if (!environment.findAsset(mainFile)) {
      // restore mincer's paths
      environment.clearPaths();
      environment.appendPath(envPaths);

      next("Main client file of " + pkgName + " not found: " + mainFile);
      return;
    }

    //
    // compile and write main file
    //

    environment.findAsset(mainFile).compile(function (err, data) {
      if (err) {
        next(err);
        return;
      }

      fs.writeFile(clientOutfile, data, 'utf8', function (err) {
        if (err) {
          next(err);
          return;
        }

        // restore mincer's paths
        environment.clearPaths();
        environment.appendPath(envPaths);

        N.logger.debug('Compiled client of %s %s', pkgName, timer.elapsed);
        fstools.remove(clientTmpTreedir, next);
      });
    });
  }, function (err) {
    N.logger.info('Processed client section %s', timer.elapsed);
    callback(err);
  });
};
