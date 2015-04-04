// Concats js/css resources per-bundle
//
//  - js packages (vendor, views, client)
//  - css packages
//  - languages
//


'use strict';


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
function readPackageStylesheet(pkgName, sandbox) {
  var filename = path.join(sandbox.tmpdir, 'styles', pkgName + '.css');
  return fs.existsSync(filename) ? fs.readFileSync(filename, 'utf8') : '';
}


// Returns map of { <locale> : <source>, ... }
//
function readPackageJavascripts(pkgName, sandbox, withLocales) {
  var data = { '*' : '' },
      tmpdir = sandbox.tmpdir,
      N = sandbox.N;

  //
  // join locale-independent data
  //

  [ 'vendor', 'views', 'client' ].forEach(function (part) {
    var filename = path.join(tmpdir, part, pkgName + '.js');

    if (fs.existsSync(filename)) {
      data['*'] += ';' + fs.readFileSync(filename, 'utf8');
    }
  });

  //
  // prepare localized data if required
  //

  if (withLocales) {
    N.config.locales.enabled.forEach(function (locale) {
      var filename = path.join(tmpdir, 'i18n', pkgName, locale + '.js');

      if (fs.existsSync(filename)) {
        data[locale] = data['*'] + ';' + fs.readFileSync(filename, 'utf8');
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
function concatFilesPerPackage(sandbox) {
  var assets = {};

  _.keys(sandbox.config.packages).forEach(function (pkgName) {
    var withLocales = _.contains(sandbox.clientI18nPackages, pkgName);

    assets[pkgName] = {
      stylesheet:   readPackageStylesheet(pkgName, sandbox),
      javascripts:  readPackageJavascripts(pkgName, sandbox, withLocales)
    };
  });

  return assets;
}


// Concat builded stylesheets from different packages and writes bundled
// stylesheet if it's non-empty
//
function writeBundleStylesheet(bndlName, sandbox, assets) {
  var stylesheet  = ''
    , filename    = path.join(sandbox.tmpdir, 'bundle', 'bundle-' + bndlName + '.css');

  _.forEach(assets, function (data) {
    stylesheet += data.stylesheet;
  });

  if (!stylesheet) {
    return null;
  }

  fs.writeFileSync(filename, stylesheet, 'utf8');
  return filename;
}


// Concat all javascripts per-bundle / locale
//
function writeBundleJavascripts(bndlName, sandbox, assets) {
  var withLocales = _.some(assets, function (data) {
        // data always contains at least one key `*`.
        // if it has more than one key, then it contains locales
        return data.javascripts && _.keys(data.javascripts).length > 1;
      }),
      N = sandbox.N,
      tmpdir = sandbox.tmpdir;

  function writeFile(locale) {
    var
    javascript  = '',
    suffix      = (locale ? ('.' + locale) : '') + '.js',
    filename    = path.join(tmpdir, 'bundle', 'bundle-' + bndlName + suffix);

    _.forEach(assets, function (data) {
      javascript += data.javascripts[locale] || data.javascripts['*'] || '';
    });

    if (!javascript) {
      return null;
    }

    fs.writeFileSync(filename, javascript, 'utf8');
    return filename;
  }

  var data = {};

  if (!withLocales) {
    data['*'] = writeFile();
  } else {
    N.config.locales.enabled.forEach(function (locale) {
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
function writeAssetsPerBundle(sandbox, assets) {
  var data = {};

  _.forEach(sandbox.config.bundles, function (packages, bndlName) {
    var bndlAssets = _.pick(assets, packages);

    data[bndlName] = {
      stylesheet:   writeBundleStylesheet(bndlName, sandbox, bndlAssets),
      javascripts:  writeBundleJavascripts(bndlName, sandbox, bndlAssets)
    };
  });

  return data;
}


// Walks over all packages in the given distibution and composes queues of
// packages and stylesheets on each.
//
// The resulting package queues are full lists of packages are needed to load in
// order to load the given package. In the exact order. These include also the
// concerned package ifself at the last position.
//
// The resulting stylesheet queues are intended to use in the view layouts for
// linking initial page stylesheets.
//
function composeLoadingQueues(sandbox, distribution) {
  _.forEach(distribution, function (localeDist) {
    _.forEach(localeDist, function (pkgDist, pkgName) {
      var alreadyLoaded,
          packagesQueue = [],
          stylesQueue  = [];

      // This function is used to recursively populate the loading queue.
      function processPackage(processPkgName) {
        var processPkgConfig = sandbox.config.packages[processPkgName];

        // Yield dependences of the current package first.
        if (processPkgConfig.depends) {
          processPkgConfig.depends.forEach(function (dependency) {
            if (packagesQueue.indexOf(dependency) === -1) {
              processPackage(dependency);
            }
          });
        }

        // Yield the current package itself at the last.
        packagesQueue.push(processPkgName);
      }

      // Compose the loading queue.
      processPackage(pkgName);

      // Compose the styles queue.
      packagesQueue.slice(0).reverse().forEach(function (depName) {
        var depDist = localeDist[depName];

        if (depDist && depDist.stylesheets.length) {
          // We have a dependency which might be included in multiple files;
          //
          // Look if we already have one file it might be included in,
          // and if we don't, add one.
          //
          alreadyLoaded = depDist.stylesheets.reduce(function (acc, possiblePath) {
            return acc || stylesQueue.indexOf(possiblePath) !== -1;
          }, false);

          if (!alreadyLoaded) {
            stylesQueue.unshift(depDist.stylesheets[0]);
          }
        }
      });

      // Expose the queues to the package distribution.
      pkgDist.packagesQueue = packagesQueue;
      pkgDist.stylesQueue   = stylesQueue;
    });
  });
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
  var // map of { <packageName>: <bundleName>, ... }
      pkgBundle = {},
      // map of { <packageName>: { <locale>: { <assets> }, ... } }
      distribution = {},
      N = sandbox.N;

  //
  // get bundles list
  //

  Object.keys(sandbox.config.bundles).forEach(function (bndlName) {
    sandbox.config.bundles[bndlName].forEach(function (pkgName) {
      if (!pkgBundle[pkgName]) {
        pkgBundle[pkgName] = [];
      }

      pkgBundle[pkgName].push(bndlName);
    });
  });

  //
  // collect assets for each package, per locale
  //

  // memoized mincer's find_assets
  var findAsset = _.memoize(function(path) {
    var timer = stopwatch();
    var asset = sandbox.assets.environment.findAsset(path);

    N.logger.debug('Created asset %s %s', path, timer.elapsed);
    return asset;
  });

  N.config.locales.enabled.forEach(function (locale) {
    distribution[locale] = {};

    Object.keys(sandbox.config.packages).forEach(function (pkgName) {
      var stylesheets, javascripts;

      if (!pkgBundle[pkgName].length) {
        throw new Error(format(
              'Package `%s` is defined, but not assigned to any bundle, ' +
              'check `bundle.yml` in appropriate application root', pkgName));
      }

      stylesheets = pkgBundle[pkgName].map(function(k) {
        var asset, stylesheet = bundleAssets[k].stylesheet;

        if (!stylesheet) {
          return false;
        }

        // generates bundle here
        asset = findAsset(stylesheet);

        sandbox.assets.files.push(asset.logicalPath);

        return asset.logicalPath;
      }).filter(Boolean);

      javascripts = pkgBundle[pkgName].map(function(k) {
        var asset, javascript = bundleAssets[k].javascripts[locale] || bundleAssets[k].javascripts['*'];

        if (!javascript) {
          return false;
        }

        // generates bundle here
        asset = findAsset(javascript);

        sandbox.assets.files.push(asset.logicalPath);

        return asset.logicalPath;
      }).filter(Boolean);

      distribution[locale][pkgName] = {
        packagesQueue: null,
        stylesQueue:   null,
        stylesheets:   stylesheets,
        javascripts:   javascripts
      };
    });
  });

  return distribution;
}


////////////////////////////////////////////////////////////////////////////////


module.exports = function (sandbox) {
  var timer   = stopwatch(),
      N       = sandbox.N,
      bndlDir = path.join(sandbox.tmpdir, 'bundle'),
      compiledPkgs,
      compiledBndls;

  // XXX Set Mincer compression here, to avoid double compression on creating
  //     package files (client.js).
  if (N.enviroment !== 'development' && process.env.NODECA_NOMINIFY !== '1') {
    sandbox.assets.environment.jsCompressor  = 'uglify';
    sandbox.assets.environment.cssCompressor = 'csswring';
  }

  fstools.mkdirSync(bndlDir);
  compiledPkgs  = concatFilesPerPackage(sandbox);
  compiledBndls = writeAssetsPerBundle(sandbox, compiledPkgs);

  sandbox.assets.environment.appendPath(bndlDir);

  // Mincer called here, to create final bundles (assets)
  sandbox.assets.distribution = createLoaderPkgsMap(sandbox, compiledBndls);
  composeLoadingQueues(sandbox, sandbox.assets.distribution);

  N.logger.info('Created bundles & loading map %s', timer.elapsed);
};
