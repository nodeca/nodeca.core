// Concats js/css resources per-bundle
//


'use strict';


/*global underscore, N*/


// stdlib
var fs    = require('fs');
var path  = require('path');


// 3rd-party
var _       = underscore;
var async   = require('async');
var fstools = require('fs-tools');


// internal
var stopwatch = require('./utils/stopwatch');


////////////////////////////////////////////////////////////////////////////////


// Returns package styesheet string
//
function readPackageStylesheet(pkgName, tmpdir) {
  var filename = path.join(tmpdir, "styles", pkgName + ".css");
  return fs.existsSync(filename) ? fs.readFileSync(filename, "utf8") : "";
}


// Returns map of { <locale> : <source>, ... }
//
function readPackageJavascripts(pkgName, tmpdir, withLocales, callback) {
  var data = { "*" : "" };

  [ "views", "client" ].forEach(function (part) {
    var filename = path.join(tmpdir, part, pkgName + '.js');

    if (fs.existsSync(filename)) {
      data["*"] += fs.readFileSync(filename, "utf8");
    }
  });

  if (withLocales) {
    N.config.locales['enabled'].forEach(function (locale) {
      var filename = path.join(tmpdir, 'i18n', pkgName, locale + '.js');

      if (fs.existsSync(filename)) {
        data[locale] = data["*"] + fs.readFileSync(filename, "utf8");
      }
    });
  }

  return data;
}


// Returns hash with package -> assets:
//
//    {
//      forum: {
//        stylesheet: <String>,
//        javascripts: {
//          "en-US": <String>,
//          ...
//        }
//      },
//
//      lib: {
//        stylesheet: <String>,
//        javascripts: {
//          "*": <String>
//        }
//      },
//
//      ...
//    }
//
function readAssetsPerPackage(tmpdir, sandbox) {
  var assets = {};

  _.each(sandbox.config.packages, function (pkgConfig, pkgName) {
    assets[pkgName] = {
      stylesheet:   readPackageStylesheet(pkgName, tmpdir),
      javascripts:  readPackageJavascripts(pkgName, tmpdir, !!pkgConfig.i18n_client)
    };
  });

  return assets;
}


// Concat stylesheets from different bundles and writes bundles stylesheet if
// it's non-empty
//
function writeBundleStylesheet(bndlName, tmpdir, assets) {
  var
  stylesheet  = "",
  filename    = path.join(tmpdir, "bundle", bndlName + ".css");

  _.each(assets, function (data) {
    stylesheet += data.stylesheet;
  });

  if (!stylesheet) {
    return null;
  }

  fs.writeFileSync(filename, stylesheet, "utf8");
  return filename;
}


// Concat all javascripts per-bundle / locale
//
function writeBundleJavascripts(bndlName, tmpdir, assets) {
  var withLocales = _.any(assets, function (data) {
    // data always contains at least one key `*`.
    // if it has more than one key, then it contains locales
    return 1 < _.keys(data);
  });

  function writeFile(locale) {
    var
    javascript  = "",
    suffix      = (locale ? ("." + locale) : ""),
    filename    = path.join(tmpdir, "bundle", bndlName + suffix + ".js");

    _.each(assets, function (data) {
      javascript += data.javascripts[locale] || data.javascripts['*'] || '';
    });

    if (!javascript) {
      return null;
    }

    fs.writeFileSync(filename, javascript, "utf8");
    return filename;
  }

  var data = {};

  if (!withLocales) {
    data["*"] = writeFile();
  } else {
    N.config.locales["enabled"].forEach(function (locale) {
      data[locale] = writeFile(locale);
    });
  }

  return data;
}


// Write bundle files
//
//    bundle/<name>.css
//    bundle/<name>.<locale>.js
//
function writeAssetsPerBundle(tmpdir, sandbox, assets) {
  var data = {};

  _.each(sandbox.config.bundles, function (packages, bndlName) {
    var bndlAssets = _.pick(assets, packages);

    data[bndlName] = {
      stylesheet:   writeBundleStylesheet(bndlName, tmpdir, bndlAssets),
      javascripts:  writeBundleJavascripts(bndlName, tmpdir, bndlAssets)
    };
  });

  return data;
}


// Returns assets distribution map
//
//    <locale>:
//      <pkgName>:
//        stylesheets:
//          - <file>
//          - ...
//        javascripts:
//          - <file>
//          - ...
//
function distributeAssets(sandbox, bundleAssets) {
  var
  // map of { <packageName>: [ <bundleName1>, ..., <bundleNameN> ] }
  pkgBundles = {},
  // map of { <packageName>: { <locale>: { <assets> }, ... } }
  distribution = {};

  //
  // get bundles list
  //

  _.each(sandbox.config.packages, function (_, pkgName) {
    pkgBundles[pkgName] = [];

    _.each(sandbox.config.bundles, function (packages, bndlName) {
      if (_.include(packages, pkgName)) {
        pkgBundles[pkgName].push(bndlName);
      }
    });
  });

  //
  // collect assets for each package per locale
  //

  N.config.locales["enabled"].forEach(function (locale) {
    distribution[locale] = {};

    _.each(sandbox.config.packages, function (_, pkgName) {
      distribution[locale][pkgName] = {
        stylesheets: [],
        javascripts: []
      };

      pkgBundles[pkgName].forEach(function (bndlName) {
        var
        assets     = bundleAssets[bndlName],
        stylesheet = assets.stylesheet,
        javascript = assets.javascripts[locale] || assets.javascripts["*"];

        if (stylesheet) {
          stylesheet = sandbox.assets.environment.findAsset(stylesheet);
          stylesheet = stylesheet.logicalPath;

          distribution[locale][pkgName].stylesheets.push(stylesheet);
          sandbox.assets.files.push(stylesheet);
        }

        if (javascript) {
          javascript = sandbox.assets.environment.findAsset(javascript);
          javascript = javascript.logicalPath;

          distribution[locale][pkgName].javascripts.push(javascript);
          sandbox.assets.files.push(javascript);
        }
      });
    });
  });

  return distribution;
}


////////////////////////////////////////////////////////////////////////////////


module.exports = function (tmpdir, sandbox, callback) {
  var timer = stopwatch();

  fstools.mkdir(path.join(tmpdir, 'bundle'), function (err) {
    var assets, bundles;

    if (err) {
      callback(err);
      return;
    }

    try {
      assets = readAssetsPerPackage(tmpdir, sandbox);
      bundles = writeAssetsPerBundle(tmpdir, sandbox, assets);
      sandbox.assets.distribution = distributeAssets(sandbox, bundles);
    } catch (err) {
      callback(err);
      return;
    }

    N.logger.debug('Concatenated dynamic assets ' + timer.elapsed);
    callback();
  });
};
