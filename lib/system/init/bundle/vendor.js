// Process chared libraries (one should not be duplicated between packages,
// and can have aliases)
// (!!!) This files can't be nested now

'use strict';

// 3rd-party
var _         = require('lodash');
var path      = require('path');
var fs        = require('fs');
var fstools   = require('fs-tools');
var findRequires = require('find-requires');

// internal
var stopwatch = require('../utils/stopwatch');
var resolveModulePath = require('./utils/resolve_module_path');

////////////////////////////////////////////////////////////////////////////////


var WRAPPER_TEMPLATE_PATH = path.join(__dirname, 'vendor', 'wrapper.tpl');
var WRAPPER_TEMPLATE = _.template(fs.readFileSync(WRAPPER_TEMPLATE_PATH, 'utf8'));


////////////////////////////////////////////////////////////////////////////////


module.exports = function (sandbox) {
  var N     = sandbox.N
    , timer = stopwatch();

  // Required (files content) should be added only once,
  // we need to share info between vendor and client bundlers to avoid dublications.
  sandbox.embeddedModulesPaths = {};

  var vendorModules = [];
  var vendorVirtualModules = {};
  var embeddedModulesPaths = sandbox.embeddedModulesPaths;

  _.forEach(sandbox.config.packages, function (pkg) {
    _.forEach(pkg.vendor[''], function (filePath) {
      vendorModules.push(filePath);
    });
  });

  _.forEach(sandbox.config.packages, function (pkg) {
    _.forEach(pkg.vendor, function (filePath, name) {
      if (name) {
        vendorVirtualModules[name] = filePath;
      }
    });
  });

  _.forEach(sandbox.config.packages, function (pkgConfig, pkgName) {
    var outfile = path.join(sandbox.tmpdir, 'vendor', pkgName + '.js')
      , result  = [];

    _.forEach(pkgConfig.vendor[''], function (filePath) {
      var directory    = path.dirname(filePath);

      var source = fs.readFileSync(filePath, 'utf8');

      // Look for:
      // - Requires of "foreign", unbundled modules.
      // - Node package-relative requires. Such as `require("nodeca.core/something")`
      findRequires(source, { raw: true }).forEach(function (match) {
        var resolvedPath;

        // Require path cannot be determinated - throw error.
        if (!match.value) {
          throw new Error("Error in 'require': file '" + filePath + "', string " + match.line + '.');
        }

        if (vendorVirtualModules[match.value]) {
          // Get path to a virtual module.
          resolvedPath = vendorVirtualModules[match.value];
        } else {
          // Resolve absolute, relative, or node-module path.
          resolvedPath = resolveModulePath(directory, match.value);
        }

        if (!resolvedPath) {
          throw 'Bundler cannot find required file "' + match.value + '" ' +
            'at ' + filePath + ':' + match.point + ':' + match.line;
        }

        // FIXME: This is not actually safe way to replace require paths, but
        // alternative ways seem be too complicated.
        source = source.replace(match.raw, JSON.stringify(resolvedPath));

        // Embed private local modules. (not described in the bundle config and
        // not embedded yet)
        if (!_.contains(vendorModules, resolvedPath) &&
          !_.contains(embeddedModulesPaths[pkgName], resolvedPath)) {

          embeddedModulesPaths[pkgName] = embeddedModulesPaths[pkgName] || [];
          embeddedModulesPaths[pkgName].push(resolvedPath);

          // Recursively embed the unbundled module.
          result.push(WRAPPER_TEMPLATE({
            name:   resolvedPath,
            source: fs.readFileSync(resolvedPath, 'utf8')
          }));
        }
      });

      result.push(WRAPPER_TEMPLATE({
        name:   filePath,
        source: source
      }));
    });

    fstools.mkdirSync(path.dirname(outfile));
    fs.writeFileSync(outfile, result.join('\n'), 'utf8');
  });

  N.logger.info('Processed vendor section %s', timer.elapsed);
};
