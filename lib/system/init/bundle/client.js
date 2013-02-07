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
var stopwatch     = require('../utils/stopwatch');
var safePropName  = require('./utils/safe_prop_name');
var Requisite     = require('./client/requisite');


////////////////////////////////////////////////////////////////////////////////


var TEMPLATE = fs.readFileSync(__dirname + '/client/template/package.js.ejs', 'utf8');


////////////////////////////////////////////////////////////////////////////////


function browserify(files, destination, callback) {
  var
  headers     = [],
  modulesList = [],
  exportsList = [],
  requisite   = new Requisite();

  _.each(files, function (pathname) {
    var // [ '["foo"]', '["bar"]', '["baz"]' ]
    apiPathParts  = pathname.apiPath.split('.').map(safePropName),
    source        = requisite.process(pathname.readSync(), pathname);

    // feed all parents of apiPath into heads array
    apiPathParts.reduce(function (prev, curr) {
      if (-1 === headers.indexOf(prev)) {
        headers.push(prev);
      }

      return prev + curr;
    });

    modulesList.push({
      apiSafe: apiPathParts.join(''),
      source:  source,
      apiPath: pathname.apiPath
    });

    exportsList.push('this' + apiPathParts.join(''));
  });

  fstools.mkdir(path.dirname(destination), function (err) {
    if (err) {
      callback(err);
      return;
    }

    fs.writeFile(destination, ejs.render(TEMPLATE, {
      requisite:  requisite.bundle(),
      headers:    _.uniq(headers.sort(), true),
      modules:    modulesList,
      exports:    exportsList
    }), 'utf8', callback);
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
    timer             = stopwatch();

    if (!clientConfig) {
      next();
      return;
    }

    browserify(clientConfig.files, clientTmpTreefile, function (err) {
      var
      // if config has "main file", respect it, otherwise use client tree only
      mainFile    = String(clientConfig.main || clientTmpTreefile),
      // get existing mincer environment
      environment = sandbox.assets.environment,
      // get current paths list, to restore it later
      envPaths    = environment.paths;

      if (err) {
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
    });
  }, function (err) {
    N.logger.info('Processed client section %s', timer.elapsed);
    callback(err);
  });
};
