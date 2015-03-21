// `i18n` section processor
//


'use strict';


// stdlib
var fs    = require('fs');
var path  = require('path');


// 3rd-party
var _          = require('lodash');
var BabelFish  = require('babelfish');
var fstools    = require('fs-tools');
var yaml       = require('js-yaml');


// internal
var stopwatch = require('../utils/stopwatch');
var findPaths = require('./utils/find_paths');


////////////////////////////////////////////////////////////////////////////////


var wrapper_template_path = path.join(__dirname, 'i18n', 'wrapper.tpl');
var wrapper_template = _.template(fs.readFileSync(wrapper_template_path, 'utf8'));


////////////////////////////////////////////////////////////////////////////////


//  initLocalesConfig(N, knownLocales) -> Void
//  - knownLocales (Array): List of found locales.
//
//  Initialize, validate and auto-fill (if needed) N.config.locales
//
function initLocalesConfig(N, knownLocales) {
  // That's almost impossible, but can cause nasty error with default config:
  // if no translation files found - set `en-US` locale by default
  if (!knownLocales.length) {
    knownLocales = [ 'en-US' ];
  }

  var localesConfig  = N.config.locales      || (N.config.locales = []),
      enabledLocales = localesConfig.enabled || knownLocales,
      defaultLocale  = localesConfig.default || enabledLocales[0];

  if (enabledLocales.indexOf(defaultLocale) < 0) {
    throw new Error('Default locale <' + defaultLocale + '> must be enabled');
  }

  // reset languages configuration
  N.config.locales.default = defaultLocale;
  N.config.locales.enabled = enabledLocales;
}


// Load translations from the given file (by path) using proper YAML settings.
// It uses JS-YAML's FAILSAFE_SCHEMA for security reasons, i.e. no functions,
// no merges, no regexps, etc. Only plain objects, arrays and strings.
//
function loadI18nFile(file) {
  var contents = fs.readFileSync(file, 'utf8'),
      result   = yaml.safeLoad(contents, { filename: file });

  return result;
}


////////////////////////////////////////////////////////////////////////////////


module.exports = function (sandbox) {
  var N                   = sandbox.N,
      knownLocales        = [],
      serverI18n          = null,
      clientI18n          = null,
      clientI18nPackages  = [],
      tmpdir              = sandbox.tmpdir,
      timer               = stopwatch();

  var md  = require('markdown-it')({ html: true, linkify: true, typographer: true })
              .use(require('markdown-it-sup'));

  // Initialize BabelFishes
  // Fallback locale != default locale.
  // We use 'en-US' because it should always contain all phrases.
  serverI18n = new BabelFish('en-US');
  clientI18n = {};

  Object.keys(sandbox.config.packages).forEach(function (pkgName) {
    clientI18n[pkgName] = new BabelFish('en-US');
  });

  // Normalize objject with phrases:
  //
  // - flatten keys, except started with `=`
  // - cut /^=/ from key names (and leave value object intact for those)
  // - convert with markdown all string values, started with /^md:/.
  //
  function normalize(phrases, prefix, accum) {
    prefix = prefix || '';
    accum  = accum || {};

    _.forEach(phrases, function (val, key) {
      if (key[0] === '=') {
        accum[prefix + key.slice(1)] = val;
        return;
      }

      if (_.isString(val)) {
        accum[prefix + key] = /^md:/.test(val) ? md.render(val.slice(3)) : val;
        return;
      }

      if (_.isObject(val)) {
        normalize(val, prefix + key + '.', accum);
        return;
      }

      accum[prefix + key] = val;
    });

    return accum;
  }

  function addServerI18n(locale, apiPath, phrases) {
    var normPhrases = normalize(phrases);

    serverI18n.addPhrase(locale, apiPath, normPhrases, 1);

    if (knownLocales.indexOf(locale) < 0) {
      knownLocales.push(locale);
    }
  }

  function addClientI18n(locale, pkgName, apiPath, phrases) {
    var normPhrases = normalize(phrases);

    serverI18n.addPhrase(locale, apiPath, normPhrases, 1);
    clientI18n[pkgName].addPhrase(locale, apiPath, normPhrases, 1);

    if (!_.isEmpty(phrases) && clientI18nPackages.indexOf(pkgName) < 0) {
      clientI18nPackages.push(pkgName);
    }

    if (knownLocales.indexOf(locale) < 0) {
      knownLocales.push(locale);
    }
  }

  // Collect translations of all packages (in modules tree).
  _.forEach(sandbox.config.packages, function (pkgConfig, pkgName) {

    findPaths(pkgConfig.i18n_client, function (fsPath, apiPath) {
      _.forEach(loadI18nFile(fsPath), function (phrases, locale) {
        addClientI18n(locale, pkgName, apiPath, phrases);
      });
    });

    findPaths(pkgConfig.i18n_server, function (fsPath, apiPath) {
      _.forEach(loadI18nFile(fsPath), function (phrases, locale) {
        addServerI18n(locale, apiPath, phrases);
      });
    });
  });

  // Collect global translations.
  _.forEach(N.config.i18n, function (locale, localeName) {
    _.forEach(locale, function (phrases, pkgName) {
      addClientI18n(localeName, pkgName, pkgName, phrases);
    });
  });

  // Correct the application config if needed
  initLocalesConfig(N, knownLocales);

  // Write client-side i18n bundles for each package and locale.
  Object.keys(sandbox.config.packages).forEach(function (pkgName) {
    var outdir = path.join(tmpdir, 'i18n', pkgName);

    fstools.mkdirSync(outdir);

    N.config.locales.enabled.forEach(function (locale) {
      var result = '', outfile = path.join(outdir, locale + '.js');

      result = wrapper_template({
        locale: locale,
        data: clientI18n[pkgName].stringify(locale)
      });

      fs.writeFileSync(outfile, result, 'utf8');
    });
  });

  // Expose server locales.
  N.i18n = serverI18n;

  // Expose list of packages with client-side i18n.
  sandbox.clientI18nPackages = clientI18nPackages;

  N.logger.info('Processed i18_* sections %s', timer.elapsed);
};
