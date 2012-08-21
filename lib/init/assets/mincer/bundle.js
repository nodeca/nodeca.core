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


function collectVariants(root, callback) {
  var variants = [];

  async.forEach(nodeca.config.locales.enabled, function (locale, nextLocale) {
    async.forEach(_.keys(nodeca.config.theme_schemas), function (theme, nextTheme) {
      var sources = [ path.join(root, 'system'), path.join(root, 'views', locale, theme) ];
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


function buildBundleData(variants, environment) {
  var data = {};

  variants.forEach(function (variant) {
    var parts     = [],
        namespace = variant.namespace,
        locale    = variant.locale,
        theme     = variant.theme;

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

    data[namespace + '.' + theme + '.' + locale] = _.filter(parts, function (asset) {
      return !!environment.findAsset(asset);
    }).map(function (asset) {
      return '//= require ' + asset;
    }).join('\n');
  });

  return data;
}


function buildDistribution(variants) {
  var distribution = {};

  variants.forEach(function (variant) {
    var namespace = variant.namespace,
        locale    = variant.locale,
        theme     = variant.theme;

    if (!distribution[locale + '.' + theme]) {
      distribution[locale + '.' + theme] = {};
    }

    distribution[locale + '.' + theme][namespace] = {
      js:  ['/assets/' + ['app', namespace, theme, locale, 'bundle.js'].join('.')],
      css: ['/assets/' + [theme, namespace, 'app.css'].join('/')]
    };
  });

  return distribution;
}


function write(output, bundles, callback) {
  fstools.mkdir(output, function (err) {
    if (err) {
      callback(err);
      return;
    }

    async.forEach(_.keys(bundles), function (key, next) {
      var filename = path.join(output, 'app.' + key + '.bundle.js');
      fs.writeFile(filename, bundles[key], next);
    }, callback);
  });
}


////////////////////////////////////////////////////////////////////////////////


// compile(root, environment, callback(err, distribution)) -> Void
// - root (String): Pathname where sources and where to output bundle dir
// - environment (Mincer.Environment): Configured environment
// - callback (Function): Executed once everything is done
//
// Writes bundle files for all known namespaces, locales and themes.
//
function compile(root, environment, callback) {
  collectVariants(root, function (err, variants) {
    if (err) {
      callback(err);
      return;
    }

    var bundles = buildBundleData(variants, environment);
    write(path.join(root, 'bundle'), bundles, function (err) {
      callback(err, buildDistribution(variants));
    });
  });
}


////////////////////////////////////////////////////////////////////////////////


module.exports.compile = compile;
