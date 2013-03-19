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


////////////////////////////////////////////////////////////////////////////////


var WRAPPER_TEMPLATE_PATH = path.join(__dirname, 'client', 'wrapper.tpl');
var WRAPPER_TEMPLATE      = _.template(fs.readFileSync(WRAPPER_TEMPLATE_PATH, 'utf8'));


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
function hasBundledModule(fullModulePath) {
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


// Wraps the given `source` as a module definition for the client-side loader.
// Recursively browserifies and embeds all of unbundled dependencies.
function browserifySource(source, options) {
  var template    = options.template    || null
    , fsPath      = options.fsPath      || null
    , apiPath     = options.apiPath     || null
    , skipMissing = options.skipMissing || false
    , embedCache  = options.embedCache  || []
    , result      = ''
    , directory   = fsPath ? path.dirname(fsPath) : null;

  // Look for:
  // - Requires of "foreign", unbundled modules.
  // - Node package-relative requires. Such as `require("nodeca.core/something")`
  findRequires(source, { raw: true }).forEach(function (match) {
    var firstPathNode
      , resolvedPath
      , dependencySource;

    // Require path cannot be determinated - skip.
    if (!match.value) {
      return;
    }

    firstPathNode = match.value.split(path.sep)[0];
    resolvedPath  = resolveModulePath(directory, match.value);

    if (!fs.existsSync(resolvedPath)) {
      if (skipMissing) {
        return; // Continue forEach.
      } else {
        throw new Error(
          (fsPath || 'Some file (the location is unknown)') +
          ' requires a non-existent client-side module: ' +
          resolvedPath
        );
      }
    }

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
    if (!hasBundledModule(resolvedPath) &&
        !_.contains(embedCache, resolvedPath)) {

      embedCache.push(resolvedPath);
      dependencySource = fs.readFileSync(resolvedPath, 'utf8');

      // Recursively browserify and embed the unbundled module.
      result += browserifySource(dependencySource, {
        template:   WRAPPER_TEMPLATE
      , fsPath:     resolvedPath
      , embedCache: embedCache
      });
    }
  });

  if (template) {
    result += template({
      name:    fsPath  || null
    , apiPath: apiPath || null
    , root:    directory
    , source:  source
    });
  } else {
    result += source;
  }

  return result;
}


// Wraps all of the given files for in-browser use and writes the result into
// the destination filepath. `files` should be an array of Pathname objects
// taken from `client` section of a package.
function browserifyFiles(files, destination) {
  var result = '';

  // Write module definitions.
  _.forEach(files, function (pathname) {
    result += browserifySource(pathname.readSync(), {
      template: WRAPPER_TEMPLATE
    , fsPath:   pathname.toString()
    , apiPath:  pathname.apiPath
    });
  });

  // After all modules are defined, require each one.
  _.forEach(files, function (pathname) {
    result += 'require(' + JSON.stringify(pathname.toString()) + ');\n';
  });

  // Write the result to the destination.
  fstools.mkdirSync(path.dirname(destination));
  fs.writeFileSync(destination, result, 'utf8');
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
      browserifyFiles(clientConfig.files, clientTmpTreefile);
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
