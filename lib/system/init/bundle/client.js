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
var WRAPPER_TEMPLATE = _.template(fs.readFileSync(WRAPPER_TEMPLATE_PATH, 'utf8'));


// Contains full list of bundled modules (files) of the current sandbox.
var vendorModules;
var clientModules;


////////////////////////////////////////////////////////////////////////////////


// Wraps the given source code string as a module definition for the client-side
// loader. Recursively browserifies and embeds all of unbundled dependencies.
function browserifySingle(source, options) {
  var dontWrap    = options.dontWrap    || false
    , apiPath     = options.apiPath     || null
    , skipMissing = options.skipMissing || false
    , embedCache  = options.embedCache  || []
    , modulesList = options.modulesList || null // External array of wrote modules.
    , result      = []
    , fsPath      = options.fsPath
    , directory   = path.dirname(fsPath);

  if (!fsPath) {
    throw new Error('Missed required `fsPath` argument.');
  }

  // Look for:
  // - Requires of "foreign", unbundled modules.
  // - Node package-relative requires. Such as `require("nodeca.core/something")`
  findRequires(source, { raw: true }).forEach(function (match) {
    var resolvedPath, dependencySource;

    // Require path cannot be determinated - skip.
    if (!match.value) {
      return;
    }

    resolvedPath = resolveModulePath(directory, match.value);

    if (!fs.existsSync(resolvedPath)) {
      if (skipMissing) {
        return; // Continue forEach.
      } else {
        throw new Error(fsPath + ' cannot require a non-existent module ' +
                        resolvedPath + ' at line ' + match.line);
      }
    }

    if (_.contains(clientModules, resolvedPath)) {
      throw new Error(fsPath + ' require of a client block is prohibited ' +
                      'at line ' + match.line + ' (' + resolvedPath + ')');
    }

    // FIXME: This is not actually safe way to replace require paths, but
    // alternative ways seem be too complicated.
    source = source.replace(match.raw, JSON.stringify(resolvedPath));

    // Embed private local modules. (not described in the bundle config and
    // not embedded yet)
    if (!_.contains(vendorModules, resolvedPath) &&
        !_.contains(embedCache, resolvedPath)) {

      embedCache.push(resolvedPath);
      dependencySource = fs.readFileSync(resolvedPath, 'utf8');

      // Recursively browserify and embed the unbundled module.
      result.push(browserifySingle(dependencySource, {
        fsPath:     resolvedPath
      , embedCache: embedCache
      }));

      // Register this dependency.
      if (modulesList) {
        modulesList.push(resolvedPath);
      }
    }
  });

  if (dontWrap) {
    result.push(source);
  } else {
    result.push(WRAPPER_TEMPLATE({
      name:    fsPath  || null
    , apiPath: apiPath || null
    , root:    directory
    , source:  source
    }));
  }

  // Register this module.
  if (modulesList && fsPath) {
    modulesList.push(fsPath);
  }

  return result.join('\n');
}


// Wraps all of the given files for in-browser use and writes the result into
// the destination filepath. `files` should be an array of Pathname objects
// taken from `client` section of a package.
function browserifyFiles(files, destination, modulesList) {
  var result     = []
    , embedCache = [];

  // Write module definitions.
  _.forEach(files, function (pathname) {
    result.push(browserifySingle(pathname.readSync(), {
      fsPath:      pathname.toString()
    , apiPath:     pathname.apiPath
    , embedCache:  embedCache
    , modulesList: modulesList
    }));
  });

  // Write the result to the destination.
  fstools.mkdirSync(path.dirname(destination));
  fs.writeFileSync(destination, result.join('\n'), 'utf8');
}


////////////////////////////////////////////////////////////////////////////////


module.exports = function (sandbox, callback) {
  var timer = stopwatch()
    , N = sandbox.N
    , tmpdir = sandbox.tmpdir;

  //
  // Collect flat lists of all `vendor` and `client` files from all packages.
  //

  vendorModules =
    _(sandbox.config.packages)
    .pluck('vendor')
    .compact()
    .reduce(function (result, vendor) {
      return result.concat(_.values(vendor));
    }, []);

  clientModules =
    _(sandbox.config.packages)
    .pluck('client')
    .compact()
    .reduce(function (result, client) {
      return result.concat(_.invoke(client.files, 'toString'));
    }, []);

  //
  // Build client files for each package
  //

  async.forEachSeries(_.keys(sandbox.config.packages), function (pkgName, next) {
    var clientConfig       = sandbox.config.packages[pkgName].client
        // final file (contains client tree and main file)
      , clientOutfile      = path.join(tmpdir, 'client', pkgName + '.js')
        // isolated directory with client tree
      , clientTmpTreedir   = path.join(tmpdir, 'client', pkgName)
        // client tree
      , clientTmpTreefile  = path.join(clientTmpTreedir, 'client.js')
        // per-package timer
      , timer              = stopwatch()
        // if config has "main file", respect it, otherwise use client tree only
      , mainFile
        // get existing mincer environment
      , environment        = sandbox.assets.environment
        // get current paths list, to restore it later
      , envPaths           = environment.paths
        // List of all modules bundled to the package.
      , pkgModulesList = [];

    if (!clientConfig) {
      next();
      return;
    }

    try {
      browserifyFiles(clientConfig.files, clientTmpTreefile, pkgModulesList);
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

      var source = data.toString();

      if (clientConfig.main) {
        try {
          source = browserifySingle(source, {
            fsPath: mainFile
            // Main files are handled by Mincer and should *not* be wrapped with
            // define(..., function (...) { ... });
          , dontWrap: true
            // Files bundled by Mincer sometimes contain requires of Node-specific
            // modules, e.g. client-side version of Jade contains `requrie('fs')`.
          , skipMissing: true
          });
        } catch (err) {
          next(err);
          return;
        }
      }

      // Initialize package modules.
      _.unique(pkgModulesList).forEach(function (moduleId) {
        source += '\nNodecaLoader.require(' + JSON.stringify(moduleId) + ');';
      });

      // The current package is complete.
      fs.writeFile(clientOutfile, source, 'utf8', function (err) {
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
