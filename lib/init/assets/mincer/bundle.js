"use strict";


/*global nodeca, _*/


// stdlib
var fs   = require('fs');
var path = require('path');


// 3rd-party
var async   = require('nlib').Vendor.Async;
var fstools = require('nlib').Vendor.FsTools;


// internal
var collectNamespaces = require('../namespaces').collect;


////////////////////////////////////////////////////////////////////////////////


// collect(root, callback(err, variants)) -> Void
// - root (String): Pathname where compiled api trees and views are placed
// - callback (Function): Executed once everything is done
//
// Collect available `{namespace + locale + theme}` variants.
//
function collect(root, callback) {
  var variants = [];

  async.forEach(nodeca.config.locales.enabled, function (locale, nextLocale) {
    async.forEach(_.keys(nodeca.config.themes.schemas), function (theme, nextTheme) {
      var sources = [
        // namespaces of browserified API trees
        path.join(root, 'system'),
        // namespaces of themed and localized views
        path.join(root, 'compiled/views', locale, theme)
      ];

      //
      // Collect union of client and views namespaces
      //

      collectNamespaces(sources, function (err, nsPaths) {
        if (err) {
          nextTheme(err);
          return;
        }

        _.keys(nsPaths).forEach(function (namespace) {
          if ('layouts' === namespace) {
            // skip special case namespaces
            return;
          }

          variants.push({ namespace: namespace, locale: locale, theme: theme });
        });

        nextTheme();
      });
    }, nextLocale);
  }, function (err) {
    callback(err, variants);
  });
}


// internal
// getBundledFilename(variant) -> String
// - variant (Object): Structure with `namespace`, `locale` and `theme` fields
//
// Returns "standartized" filename for a bundled source.
//
function getBundledFilename(variant) {
  return ['app', variant.namespace, variant.locale, variant.theme, 'bundle.js'].join('.');
}


// distribute(variants, environment) -> Object
// - variants (Array): List of possible namespace + locale + theme variants
// - environment (Mincer.Environment): Configured environment
//
// Returns a map of assets for all namespaces (for (loadAssets.init()`):
//
//    {
//      "<locale>.<theme>": {    # we build map for each locale+theme variant
//        "<namespace>": {       #
//          js:  [ ... ],        # each namespace have a list of js and css
//          css: [ ... ]         # files, that will always contain only 0 or 1
//        },                     # element with digest path, e.g.:
//        ...                    # `[]` or `['/assets/foobar-....js']`
//      },
//      ...
//    }
//
// This map will be used with `loadAssets.init()`, e.g.:
//
//    script(type="application/javascript")
//      loadAssets.init(
//        !{JSON.stringify(distribution[self.locale + '.' + self.theme])},
//        !{JSON.stringify(self.namespace)}
//      )
//
// **WARNING** Make sure to call it ONLY AFTER
//             `Environment.precompile` or `Manifest.compile` were executed.
//
function distribute(variants, environment) {
  var distribution = {};


  function findAsset(logicalPath) {
    var asset = environment.findAsset(logicalPath);
    return !asset ? [] : ['/assets/' + asset.digestPath];
  }

  variants.forEach(function (variant) {
    var key = variant.locale + '.' + variant.theme;

    if (!distribution[key]) {
      distribution[key] = {};
    }

    distribution[key][variant.namespace] = {
      js:   findAsset(getBundledFilename(variant)),
      css:  findAsset([variant.theme, variant.namespace, 'app.css'].join('/'))
    };
  });

  return distribution;
}


// process(root, variants, environment, callback(err)) -> Void
// - root (String): Pathname where to write directory with bundle files
// - variants (Array): List of possible namespace + locale + theme variants
// - environment (Mincer.Environment): Configured environment
// - callback (Function): Executed once everything is done
//
// Writes bundle files for all known namespaces, locales and themes into
// `<root>/bundle` directory.
//
// **NOTICE** We are bundling JavaScript files only, as CSS files are initially
// placed correctly under `{theme}/{namespace}` directories.
//
// Each bundled file will contain (in order):
//
// * Localized views          => `views/{locale}/{theme}/{namespace}.js`
// * Compiled translations    => `{namespace}/i18n/{locale}.js`
// * Browserified API trees   => `{namespace}/api.js`
// * Themed namespace app.js  => `{theme}/{namespace}/app.js
//
// Special case namesapaces `common` and `admin` will include (prior to the
// parts described above) also:
//
// * 3rd-party libraries      => `lib.js`
// * Compiled layouts         => `views/{locale}/{theme}/layouts.js`
//
function process(root, variants, environment, callback) {
  var bundles = {};

  variants.forEach(function (variant) {
    var parts     = [],
        namespace = variant.namespace,
        locale    = variant.locale,
        theme     = variant.theme,
        filename  = getBundledFilename(variant);

    if ('common' === namespace || 'admin' === namespace) {
      parts.push('lib.js');
      parts.push('views/' + locale + '/' + theme + '/layouts.js');
    }

    parts.push(
      'views/' + locale + '/' + theme + '/' + namespace + '.js',
      namespace + '/i18n/' + locale + '.js',
      namespace + '/api.js',
      theme + '/' + namespace + '/app.js'
    );

    bundles[filename] = _.filter(parts, function (asset) {
      // leave ONLY existing files
      return !!environment.findAsset(asset);
    }).map(function (asset) {
      return '//= require ' + asset;
    }).join('\n');
  });

  fstools.mkdir(path.join(root, 'bundle'), function (err) {
    if (err) {
      callback(err);
      return;
    }

    async.forEach(_.keys(bundles), function (filename, next) {
      fs.writeFile(path.join(root, 'bundle', filename), bundles[filename], next);
    }, callback);
  });
}


////////////////////////////////////////////////////////////////////////////////


module.exports.collect    = collect;
module.exports.process    = process;
module.exports.distribute = distribute;
