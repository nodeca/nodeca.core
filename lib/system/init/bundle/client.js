// `client` section processor
//


'use strict';


// stdlib
var fs    = require('fs');
var path  = require('path');


// 3rd-party
var _            = require('lodash');
var ejs          = require('ejs');
var async        = require('async');
var fstools      = require('fs-tools');
var findRequires = require('find-requires');


// internal
var stopwatch         = require('../utils/stopwatch');
var resolveModulePath = require('./utils/resolve_module_path');
var jetson            = require('../../jetson');


////////////////////////////////////////////////////////////////////////////////


var WRAPPER_TEMPLATE_PATH = path.join(__dirname, 'client', 'wrapper.tpl');
var WRAPPER_TEMPLATE = _.template(fs.readFileSync(WRAPPER_TEMPLATE_PATH, 'utf8'));


// Contains full list of bundled modules (files) of the current sandbox.
var vendorModules;
var clientModules;


////////////////////////////////////////////////////////////////////////////////


var HEADER_COMMENT_PATTERN = new RegExp(
  '^(?:\\s*' +
    '(' +
      '(?:\/[*](?:\\s*|.+?)*?[*]\/)' + '|' +
      '(?:\/\/.*\n?)+' +
    ')*' +
  '\\s*)*', 'm');


// Wraps the given source code string as a module definition for the client-side
// loader. Recursively browserifies and embeds all of unbundled dependencies.
function browserifySingle(source, options) {
  var dontWrap     = options.dontWrap    || false
    , apiPath      = options.apiPath     || null
    , embedCache   = options.embedCache  || []
    , result       = []
    , fsPath       = options.fsPath
    , directory    = path.dirname(fsPath)
    , commentMatch = HEADER_COMMENT_PATTERN.exec(source);

  if (!fsPath) {
    throw new Error('Missed required `fsPath` argument.');
  }

  // Header comment must at the top of the result.
  if (commentMatch) {
    result.push(source.slice(0, commentMatch[0].length));
    source = source.slice(commentMatch[0].length);
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
      throw new Error(fsPath + ' cannot require a non-existent module ' +
                      resolvedPath + ' at line ' + match.line);
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

  return result.join('\n');
}


// Wraps all of the given files for in-browser use and writes the result into
// the destination filepath. `files` should be an array of Pathname objects
// taken from `client` section of a package.
function browserifyFiles(files, destination) {
  var result      = []
    , embedCache  = [];

  // Write module definitions.
  _.forEach(files, function (pathname) {
    result.push(browserifySingle(pathname.readSync(), {
      fsPath:     pathname.toString()
    , apiPath:    pathname.apiPath
    , embedCache: embedCache
    }));
  });

  // Write the result to the destination.
  fstools.mkdirSync(path.dirname(destination));
  fs.writeFileSync(destination, result.join('\n'), 'utf8');
}


function browserifyMainFile(N, pathname, destination) {
  var result = pathname.readSync();

  if ('.ejs' === pathname.extname) {
    result = ejs.render(result, { N: N, jetson: jetson.serialize });
  }

  result = browserifySingle(result, {
    fsPath:   pathname.toString()
  , dontWrap: true
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

  //
  // Collect flat lists of all `vendor` and `client` files from all packages.
  //

  vendorModules =
    _(sandbox.config.packages)
    .pluck('vendor')
    .map(_.values)
    .flatten()
    .valueOf();

  clientModules =
    _(sandbox.config.packages)
    .pluck('client')
    .compact()
    .pluck('files')
    .flatten()
    .invoke('toString')
    .valueOf();

  //
  // Build client files for each package
  //

  async.forEachSeries(_.keys(sandbox.config.packages), function (pkgName, next) {
    var clientConfig = sandbox.config.packages[pkgName].client
      , resultFile   = path.join(tmpdir, 'client', pkgName + '.js')
      , workingDir   = path.join(tmpdir, 'client', pkgName)
      , mainFile     = path.join(workingDir, 'main.js')
      , modulesFile  = path.join(workingDir, 'client.js')
      , targetFile   = null // mainFile if exists; modulesFile otherwise.
      , environment  = sandbox.assets.environment
      , originPaths  = environment.paths // to restore it later
      , timer        = stopwatch();

    if (!clientConfig) {
      next();
      return;
    }

    try {
      browserifyFiles(clientConfig.files, modulesFile);

      if (clientConfig.main) {
        browserifyMainFile(N, clientConfig.main, mainFile);
        targetFile = mainFile;
      } else {
        targetFile = modulesFile;
      }
    } catch (err) {
      next(err);
      return;
    }

    // Prepend path with `modulesFile` to allow use
    //
    //   //= require client
    //
    // in main file
    environment.prependPath(workingDir);

    // When Mincer is asked for a main file, it must be within roots, that
    // Mincer knows about. See: https://github.com/nodeca/mincer/issues/51
    clientConfig.lookup.forEach(function (options) {
      environment.appendPath(options.root);
    });

    // Check that main file is requirable.
    if (!environment.findAsset(targetFile)) {
      // Restore Mincer's paths.
      environment.clearPaths();
      environment.appendPath(originPaths);

      next('Main client file of ' + pkgName + ' not found: ' + targetFile);
      return;
    }

    environment.findAsset(targetFile).compile(function (err, data) {
      if (err) {
        next(err);
        return;
      }

      var source = data.toString();

      // Initialize package modules.
      clientConfig.files.forEach(function (pathname) {
        source += '\nNodecaLoader.require(' + JSON.stringify(pathname.toString()) + ');';
      });

      // The current package is complete.
      fs.writeFile(resultFile, source, 'utf8', function (err) {
        if (err) {
          next(err);
          return;
        }

        // Restore Mincer's paths.
        environment.clearPaths();
        environment.appendPath(originPaths);

        N.logger.debug('Compiled client of %s %s', pkgName, timer.elapsed);
        fstools.remove(workingDir, next);
      });
    });
  }, function (err) {
    N.logger.info('Processed client section %s', timer.elapsed);
    callback(err);
  });
};
