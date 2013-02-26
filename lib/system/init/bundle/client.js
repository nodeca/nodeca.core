// `client` section processor
//


'use strict';


// stdlib
var fs    = require('fs');
var path  = require('path');


// 3rd-party
var _            = require('lodash');
var async        = require('async');
var ejs          = require('ejs');
var fstools      = require('fs-tools');
var findRequires = require('find-requires');


// internal
var stopwatch         = require('../utils/stopwatch');
var resolveModulePath = require('./utils/resolve_module_path');
var Pathname          = require('./utils/pathname');


////////////////////////////////////////////////////////////////////////////////


var TEMPLATE = fs.readFileSync(path.join(__dirname, 'client', 'template.js.ejs'), 'utf8');


////////////////////////////////////////////////////////////////////////////////


// Check if the module by absolute path is already bundled.
function hasBundledModule(sandbox, fullModulePath) {
  var moduleExt, modulePath, found = false;

  moduleExt  = path.extname(modulePath);
  modulePath = path.basename(fullModulePath, moduleExt);

  _.each(sandbox.packages, function (pkgConfig) {
    var bundledFiles = [];

    if (found) {
      return false;
    }

    // Collect client bundled files.
    if (pkgConfig.client && pkgConfig.client.files) {
      bundledFiles =
        _.union(bundledFiles, _.invoke(pkgConfig.client.files, 'toString'));
    }

    // Collect vendor bundled files.
    if (pkgConfig.vendor) {
      bundledFiles =
        _.union(bundledFiles, _.values(pkgConfig.vendor));
    }

    // Check for the existence.
    _.each(bundledFiles, function (bundledPath) {
      var bundledExt;

      if (found) {
        return false;
      }

      bundledExt  = path.extname(bundledPath);
      bundledPath = path.basename(bundledPath, bundledExt);

      // If the module we looking for has no explicit extension, accept any
      // available extension on bundled modules.
      if (('' === moduleExt || moduleExt === bundledExt) &&
          (modulePath === bundledPath)) {
        found = true;
      }
    });
  });

  return found;
}


// Wraps all of the given files for in-browser use and writes the result into
// the destination filepath. `files` should be an array of Pathname objects
// taken from `client` section of a package.
function browserify(sandbox, files, destination, embedCache) {
  if (_.isEmpty(embedCache)) {
    embedCache = [];
  }

  fstools.mkdirSync(path.dirname(destination));

  // NOTE: `browserify` is recursive. So it's needed to check for the
  // destination already exists first.
  if (!fs.existsSync(destination)) {
    // File must be created even if package has no client section.
    fs.writeFileSync(destination, '', 'utf8');
  }

  // Write module definitions.
  _.each(files, function (pathname) {
    var result, source = pathname.readSync();

    // Look for requires of "foreign", unbundled modules.
    findRequires(source).forEach(function (modulePath) {
      var moduleFile;

      modulePath = resolveModulePath(pathname.dirname, modulePath);

      // If the module is not bundled anyway, embed it.
      if (!hasBundledModule(sandbox, modulePath) &&
          !_.contains(embedCache, modulePath)) {

        embedCache.push(modulePath);

        if ('' === path.extname(modulePath)) {
          // Setup the default extension if no any.
          moduleFile = new Pathname(modulePath + '.js', {apiPath: null});
        } else {
          moduleFile = new Pathname(modulePath, {apiPath: null});
        }

        // Recursively browserify and embed the unbundled module.
        browserify(sandbox, [moduleFile], destination, embedCache);
      }
    });

    result = ejs.render(TEMPLATE, {
      name:    JSON.stringify(pathname.toString())
    , apiPath: JSON.stringify(pathname.apiPath)
    , root:    JSON.stringify(pathname.dirname)
    , source:  source
    });

    fs.appendFileSync(destination, result, 'utf8');
  });

  // After all modules are defined, require each one.
  _.each(files, function (pathname) {
    var result = 'require(' + JSON.stringify(pathname.toString()) + ');\n';

    fs.appendFileSync(destination, result, 'utf8');
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
      browserify(sandbox, clientConfig.files, clientTmpTreefile);
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
