// Concats js/css resources per-bundle
//


'use strict';


/*global N*/


// stdlib
var fs      = require('fs');
var path    = require('path');
var format  = require('util').format;


// 3rd-party
var _       = require('lodash');
var fstools = require('fs-tools');


// internal
var stopwatch = require('../utils/stopwatch');


////////////////////////////////////////////////////////////////////////////////


// Returns package styesheet string
//
function readPackageStylesheet(pkgName, tmpdir) {
  var filename = path.join(tmpdir, "styles", pkgName + ".css");
  return fs.existsSync(filename) ? fs.readFileSync(filename, "utf8") : "";
}


// Returns map of { <locale> : <source>, ... }
//
function readPackageJavascripts(pkgName, tmpdir, withLocales) {
  var data = { "*" : "" };

  //
  // join locale-independent data
  //

  [ "views", "client" ].forEach(function (part) {
    var filename = path.join(tmpdir, part, pkgName + '.js');

    if (fs.existsSync(filename)) {
      data["*"] += ';' + fs.readFileSync(filename, "utf8");
    }
  });

  //
  // prepare localized data if required
  //

  if (withLocales) {
    N.config.locales['enabled'].forEach(function (locale) {
      var filename = path.join(tmpdir, 'i18n', pkgName, locale + '.js');

      if (fs.existsSync(filename)) {
        data[locale] = data["*"] + ';' + fs.readFileSync(filename, "utf8");
      }
    });
  }

  return data;
}


// Reads stylesheets and javascripts for each package. Concatenate javascripts
// per-language if needed.
//
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
function concatFilesPerPackage(tmpdir, sandbox) {
  var
  assets    = {},
  i18nTree  = sandbox.i18nTree || {};

  _.each(sandbox.config.packages, function (pkgConfig, pkgName) {
    var withLocales = !_.isEmpty(i18nTree[pkgName] && i18nTree[pkgName].client);

    assets[pkgName] = {
      stylesheet:   readPackageStylesheet(pkgName, tmpdir),
      javascripts:  readPackageJavascripts(pkgName, tmpdir, withLocales)
    };
  });

  return assets;
}


// Concat builded stylesheets from different packages and writes bundled
// stylesheet if it's non-empty
//
function writeBundleStylesheet(bndlName, tmpdir, assets) {
  var
  stylesheet  = "",
  filename    = path.join(tmpdir, "bundle", "bundle-" + bndlName + ".css");

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
    return 1 < _.keys(data).length;
  });

  function writeFile(locale) {
    var
    javascript  = "",
    suffix      = (locale ? ("." + locale) : "") + ".js",
    filename    = path.join(tmpdir, "bundle", "bundle-" + bndlName + suffix);

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


// Returns assets distribution map that will be used by loader
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
function createLoaderPkgsMap(sandbox, bundleAssets) {
  var
  // map of { <packageName>: <bundleName>, ... }
  pkgBundle = {},
  // map of { <packageName>: { <locale>: { <assets> }, ... } }
  distribution = {};

  //
  // get bundles list
  //

  _.each(sandbox.config.bundles, function (packages, bndlName) {
    _.each(packages, function (pkgName) {
      // if pkg was included into multiple bundles, exclude it from being
      // bundled at all, as it's most likely shared library. but if it's
      // a mistake loader will be able to notify once this package called.
      pkgBundle[pkgName] = pkgBundle.hasOwnProperty(pkgName) ? null : bndlName;
    });
  });

  //
  // collect assets for each package per locale
  //

  N.config.locales["enabled"].forEach(function (locale) {
    distribution[locale] = {};

    _.each(sandbox.config.packages, function (pkgConfig, pkgName) {
      var assets, stylesheet, javascript;

      if (null === pkgBundle[pkgName]) {
        return;
      }

      assets = bundleAssets[pkgBundle[pkgName]];

      if(!assets) {
        throw new Error(format(
              'Package `%s` defined, but not assigned to any bundle, ' +
              'check `bundle.yml` in appropriate application root', pkgName));
      }

      distribution[locale][pkgName] = {
        stylesheet: null,
        javascript: null
      };

      stylesheet = assets.stylesheet;
      javascript = assets.javascripts[locale] || assets.javascripts["*"];

      if (stylesheet) {
        stylesheet = sandbox.assets.environment.findAsset(stylesheet);

        distribution[locale][pkgName].stylesheet = stylesheet.logicalPath;
        sandbox.assets.files.push(stylesheet.logicalPath);
      }

      if (javascript) {
        javascript = sandbox.assets.environment.findAsset(javascript);

        distribution[locale][pkgName].javascript = javascript.logicalPath;
        sandbox.assets.files.push(javascript.logicalPath);
      }
    });
  });

  return distribution;
}


////////////////////////////////////////////////////////////////////////////////


module.exports = function (tmpdir, sandbox, callback) {
  var
  timer   = stopwatch(),
  bndlDir = path.join(tmpdir, 'bundle');

  fstools.mkdir(bndlDir, function (err) {
    var compiledPkgs, compiledBndls;

    if (err) {
      callback(err);
      return;
    }

    try {
      compiledPkgs  = concatFilesPerPackage(tmpdir, sandbox);
      compiledBndls = writeAssetsPerBundle(tmpdir, sandbox, compiledPkgs);

      sandbox.assets.environment.appendPath(bndlDir);

      sandbox.assets.distribution = createLoaderPkgsMap(sandbox, compiledBndls);
    } catch (err) {
      callback(err);
      return;
    }

    N.logger.debug('Concatenated dynamic assets ' + timer.elapsed);
    callback();
  });
};
