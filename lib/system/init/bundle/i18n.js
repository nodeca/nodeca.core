// `i18n` section processor
//


'use strict';


// stdlib
var fs    = require('fs');
var path  = require('path');


// 3rd-party
var _         = require('lodash');
var BabelFish = require('babelfish');
var fstools   = require('fs-tools');


// internal
var stopwatch = require('../utils/stopwatch');
var serialize = require('../../jetson').serialize;
var findPaths = require('./utils/find_paths');


////////////////////////////////////////////////////////////////////////////////


var WRAPPER_TEMPLATE_PATH = path.join(__dirname, 'i18n', 'wrapper.tpl');
var WRAPPER_TEMPLATE = _.template(fs.readFileSync(WRAPPER_TEMPLATE_PATH, 'utf8'));


////////////////////////////////////////////////////////////////////////////////


function squashTree(obj, prefix) {
  var result = {};

  _.each(obj, function (val, key) {
    key = prefix + '.' + key;

    if (!_.isObject(val)) {
      result[key] = val;
      return;
    }

    _.each(squashTree(val, key), function (val, key) {
      result[key] = val;
    });
  });

  return result;
}

// similar to _.extend but recursive
function deepMerge(dst, src) {
  dst = dst || {};

  _.each(src, function (val, key) {
    if (_.isObject(dst[key]) && _.isObject(val)) {
      deepMerge(dst[key], val);
    } else {
      dst[key] = val;
    }
  });

  return dst;
}


//  collectTranslations(pathnames, locales) -> Object
//  - pathnames (Array)
//  - locales (Array)
//
// Reads pathanmes and builds translations tree.
// Populates locales with found locales
//
function collectTranslations(lookup, locales) {
  var translations = {};

  findPaths(lookup, function (fsPath, apiPath) {
    var data;

    try {
      data = require(fsPath);
    } catch (err) {
      throw new Error("Can't read i18n file '" + fsPath + "':\n" +
                      (err.stack || err.message || err));
    }

    _.forEach(data, function (phrases, locale) {
      if (-1 === locales.indexOf(locale)) {
        locales.push(locale);
      }

      if (!translations[locale]) {
        translations[locale] = {};
      }

      if (!translations[locale][apiPath]) {
        translations[locale][apiPath] = {};
      }

      deepMerge(translations[locale][apiPath], phrases);
    });
  });

  return translations;
}


//  initLocales(knownLocales) -> Void
//  - knownLocales (Array): List of found locales filled by collectTranslations
//
//  Initialize, validate and auto-fill (if needed) N.config.locales
//
function initLocales(knownLocales, N) {
  var localesConfig, enabledLocales, defaultLocale;

  // That's almost impossible, but can cause nasty error with default config:
  // if no translation files found - set `en-US` locale by default
  if (0 === knownLocales.length) {
    knownLocales = ['en-US'];
  }

  localesConfig   = N.config.locales || (N.config.locales = {}),
  enabledLocales  = localesConfig['enabled'] ? localesConfig['enabled']
                  : knownLocales,
  defaultLocale   = localesConfig['default'] ? localesConfig['default']
                  : enabledLocales[0];

  if (-1 === enabledLocales.indexOf(defaultLocale)) {
    throw "Default locale <" + defaultLocale + "> must be enabled";
  }

  // reset languages configuration
  N.config.locales = {
    "default": defaultLocale,
    "enabled": enabledLocales
  };
}


//  initServerI18n(tree)
//  - tree (Object): Translation prepared by collectTranslations
//
//  Initialize server N.runtime.i18n and populate it with translations.
//  Client and server translations are merged together for server translator,
//  but server phrases takes precedence over client
//
function initServerI18n(tree, N) {
  var united = {};

  _.each(tree, function (branch) {
    deepMerge(united, branch.client);
    deepMerge(united, branch.server);
  });

  N.runtime.i18n = new BabelFish(N.config.locales['default']);

  _.each(N.config.locales['enabled'], function (locale) {
    _.each(united[locale] || {}, function (data, scope) {
      N.runtime.i18n.addPhrase(locale, scope, data);
    });
  });
}


////////////////////////////////////////////////////////////////////////////////


module.exports = function (sandbox, callback) {
  var config = sandbox.config
    , timer = stopwatch()
    , locales = [] // array of known locales
    , tree = {}
    , tmpdir = sandbox.tmpdir
    , N = sandbox.N;

  // expose i18n tree for compiler
  sandbox.i18nTree = tree;

  try {
    // collect translations of all packages in a common tree
    _.each(config.packages, function (pkgConfig, pkgName) {
      tree[pkgName] = {
        server: collectTranslations(pkgConfig.i18n_server, locales),
        client: collectTranslations(pkgConfig.i18n_client, locales)
      };
    });

    // collect global translations
    N.runtime.apps.forEach(function (app) {
      var pathname = path.join(app.root, "config/locales");

      fstools.walkSync(pathname, /\.yml$/, function (file) {
        _.each(require(file).i18n || {}, function (data, locale) {
          if (-1 === locales.indexOf(locale)) {
            locales.push(locale);
          }

          _.each(data, function (phrases, pkgName) {
            if (!tree[pkgName]) {
              tree[pkgName] = { server: {}, client: {} };
            }

            if (!tree[pkgName].client[locale]) {
              tree[pkgName].client[locale] = {};
            }

            tree[pkgName].client[locale] = deepMerge(
              squashTree(phrases, pkgName),
              tree[pkgName].client[locale]);
          });
        });
      });
    });

    // tree ->
    //
    //    <pkgName>:
    //      client:
    //        <locale>:
    //          <phrase>:
    //            <phrase>: translation
    //            ...
    //          <phrase>: translation
    //          ...
    //        ...
    //      server:
    //        ...
    //
    //    tree['fontello']['client']['en-US']['app']['title']

    initLocales(locales, N);
    initServerI18n(tree, N);

    // create client-side i18n bundles for each package/locale
    _.keys(config.packages).forEach(function (pkgName) {
      var
      i18n    = new BabelFish(N.config.locales['default']),
      branch  = tree[pkgName].client,
      outdir  = path.join(tmpdir, 'i18n', pkgName);

      fstools.mkdirSync(outdir);

      // fill in data of all enabled locales
      _.each(N.config.locales['enabled'], function (locale) {
        _.each(branch[locale] || {}, function (data, scope) {
          i18n.addPhrase(locale, scope, data);
        });
      });

      // flush out compiled phrases
      _.each(N.config.locales['enabled'], function (locale) {
        var source, outfile = path.join(outdir, locale + '.js');

        source = WRAPPER_TEMPLATE({
          locale: locale
        , data:   serialize(i18n.getCompiledData(locale))
        });

        fs.writeFileSync(outfile, source, 'utf8');
      });
    });
  } catch (err) {
    callback(err);
    return;
  } finally {
    N.logger.info('Processed i18_* sections %s', timer.elapsed);
  }

  callback();
};
