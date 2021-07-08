'use strict';


const _       = require('lodash');
const path    = require('path');
const cached  = require('./fs_cached');
const resolve_module_path = require('./resolve_module_path');


// Returns normalized version of vendor section of a package definition.
// Resolves all file paths relative to `app.root` using `resolveModulePath`.
//
// NOTE: Normalized vendor section is different from the config origin.
//
// Config:
//
// ```
// vendor:
//   - lodash
//   - bar: "./path/to/bar.js"
// ```
//
// Normalized:
//
// ```
// vendor:
//   "lodash": "/absolute/path/to/lodash.js"
//   "bar": "/absolute/path/to/bar.js"
// ```
//
function normalize_vendor(appRoot, config) {
  let result = {};

  for (let vendorPkg of Object.values(config)) {
    let filename, moduleName, resolvedPath;

    if (_.isPlainObject(vendorPkg)) {
      moduleName = Object.keys(vendorPkg);

      if (moduleName.length === 1) {
        moduleName = moduleName[0];
        filename = vendorPkg[moduleName];
      } else {
        throw new Error('Ill-formed list of vendor files.');
      }
    } else {
      moduleName = vendorPkg;
      filename = vendorPkg;
    }

    resolvedPath = resolve_module_path(appRoot, filename);

    if (!resolvedPath) {
      throw `Bundler cannot find declared vendor file "${filename}"`;
    }

    result[moduleName] = resolvedPath;
  }

  return result;
}


function normalize_pkg_config(appRoot, config) {
  config = Object.assign({
    vendor: [],
    entries: [],
    depends: []
  }, config);

  config.vendor = Array.isArray(config.vendor) ? config.vendor : [ config.vendor ];
  config.entries = Array.isArray(config.entries) ? config.entries : [ config.entries ];
  config.depends = Array.isArray(config.depends) ? config.depends : [ config.depends ];

  config.vendor = normalize_vendor(appRoot, config.vendor);

  config.entries = config.entries.map(entry_path => path.join(appRoot, entry_path));

  return config;
}


module.exports = function (appRoot) {
  let config;
  let file_path = path.join(appRoot, 'bundle.yml');

  try {
    config = cached.yaml(file_path);
  } catch (err) {
    config = {};
  }

  config.bundles = config.bundles || {};
  config.packages = config.packages || {};
  config.modules = config.modules || [];

  for (let key of Object.keys(config.packages)) {
    config.packages[key] = normalize_pkg_config(appRoot, config.packages[key]);
  }

  return config;
};
