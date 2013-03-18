// `client` section processor
//


'use strict';


// stdlib
var fs    = require('fs');
var path  = require('path');


// 3rd-party
var _            = require('lodash');
var async        = require('async');
var fstools      = require('fs-tools');
var findRequires = require('find-requires');


// internal
var stopwatch         = require('../utils/stopwatch');
var resolveModulePath = require('./utils/resolve_module_path');
var Pathname          = require('./utils/pathname');


////////////////////////////////////////////////////////////////////////////////


var TEMPLATE_PATH = path.join(__dirname, 'client', 'wrapper.tpl');
var TEMPLATE      = _.template(fs.readFileSync(TEMPLATE_PATH, 'utf8'));


// Contains full list of bundled modules (files) of the current sandbox.
var bundledModules;


////////////////////////////////////////////////////////////////////////////////


function collectBundledModules(sandbox) {
  bundledModules = [];

  _.each(sandbox.config.packages, function (pkgConfig) {

    // Collect client bundled files.
    if (pkgConfig.client && pkgConfig.client.files) {
      bundledModules =
        _.union(bundledModules, _.invoke(pkgConfig.client.files, 'toString'));
    }

    // Collect vendor bundled files.
    if (pkgConfig.vendor) {
      bundledModules =
        _.union(bundledModules, _.values(pkgConfig.vendor));
    }
  });
}


// Check if the module by absolute path is already bundled.
function hasBundledModule(sandbox, fullModulePath) {
  var moduleExt, modulePath;

  moduleExt  = path.extname(fullModulePath);
  modulePath = path.basename(fullModulePath, moduleExt);

  // Check for the existence.
  return _.any(bundledModules, function (fullBundledPath) {
    var bundledExt, bundledPath;

    bundledExt  = path.extname(fullBundledPath);
    bundledPath = path.basename(fullBundledPath, bundledExt);

    // If the module we looking for has no explicit extension, accept any
    // available extension on bundled modules.
    return ('' === moduleExt || moduleExt === bundledExt) &&
           (modulePath === bundledPath);
  });
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

    // Look for:
    // - Requires of "foreign", unbundled modules.
    // - Node package-relative requires. Such as `require("nodeca.core/something")`
    findRequires(source, { raw: true }).forEach(function (match) {
      var firstPathNode, resolvedPath, moduleFile;

      // Require path cannot be determinated - skip.
      if (!match.value) {
        return;
      }

      firstPathNode = match.value.split(path.sep)[0];
      resolvedPath  = resolveModulePath(pathname.dirname, match.value);

      // We must replace package-relative paths (e.g. "nodeca.core/something")
      // in the source in order to load such modules on the client-side.
      if (''   !== firstPathNode && // i.e. an absolute path.
          '.'  !== firstPathNode &&
          '..' !== firstPathNode) {
        // FIXME: This is not actually safe way to replace require paths, but
        // alternative ways seem be too complicated.
        source = source.replace(match.raw, JSON.stringify(resolvedPath));
      }

      // Embed private local modules. (not described in the bundle config and
      // not embedded yet)
      if (!hasBundledModule(sandbox, resolvedPath) &&
          !_.contains(embedCache, resolvedPath)) {

        embedCache.push(resolvedPath);

        if ('' === path.extname(resolvedPath)) {
          // Setup the default extension if no any.
          moduleFile = new Pathname(resolvedPath + '.js', { apiPath: null });
        } else {
          moduleFile = new Pathname(resolvedPath, { apiPath: null });
        }

        // Recursively browserify and embed the unbundled module.
        browserify(sandbox, [moduleFile], destination, embedCache);
      }
    });

    result = TEMPLATE({
      name:    pathname.toString()
    , apiPath: pathname.apiPath
    , root:    pathname.dirname
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

  collectBundledModules(sandbox);

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
