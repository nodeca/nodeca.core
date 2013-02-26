// Takes a root path and an array of vendor package declarations and returns a
// mapping of module names to absolute paths for the given packages.
// It's similar to `require.resolve()` but resolves relative paths relative to
// the given root directory instead of the current module's root.


'use strict';


var _    = require('lodash');


var resolveModulePath = require('./resolve_module_path');


////////////////////////////////////////////////////////////////////////////////


module.exports = function (rootDir, vendorList) {
  var result = {};

  _.forEach(vendorList || [], function (vendorPkg) {
    var asPair, depName, depPath;

    if (_.isPlainObject(vendorPkg)) {
      asPair = _.pairs(vendorPkg);

      if (1 !== asPair.length) {
        throw 'Ill-formed list of vendor packages.';
      }

      depName = asPair[0][0];
      depPath = asPair[0][1];
    } else {
      depName = depPath = vendorPkg;
    }

    result[depName] = resolveModulePath(rootDir, depPath);
  });

  return result;
};
