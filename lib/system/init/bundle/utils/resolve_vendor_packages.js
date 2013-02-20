// Takes a root path and an array of vendor package declarations and returns a
// mapping of module names to absolute paths for the given packages.
// It's similar to `require.resolve()` but resolves relative paths relative to
// the given root directory instead of the current module's root.


'use strict';


var path = require('path');
var _    = require('lodash');


////////////////////////////////////////////////////////////////////////////////


module.exports = function (rootDir, vendorList) {
  var result = {};

  _.forEach(vendorList || [], function (vendorPkg) {
    var asPair, depName, depPath, moduleName;

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

    moduleName = depPath.split(path.sep)[0];

    if ('.' === moduleName || '..' === moduleName) {
      depPath = path.resolve(rootDir, depPath);
    } else {
      // WARNING: `require.resolve` searches for modules from 'nodeca.core' and
      // upper. If you embed any dependences into your application locally,
      // expect problems with "non-existent modules".
      depPath = require.resolve(depPath);
    }

    result[depName] = depPath;
  });

  return result;
};
