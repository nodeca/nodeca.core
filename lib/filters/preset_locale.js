'use strict';


/*global nodeca, _*/


// cache of enabled locales in form of `parsed locale` -> `original`
//
//    { 'en,us': 'en-US', ... }
//
var enabledLocales;


// returns array with `language`, `country`. `country` might not be presented
//
function parseLocale(str) {
  return (str.match(/[a-z]+/gi) || []).map(function (s) { return s.toLowerCase(); });
}


// returns locale from the enabledLocales cache
//
function getLocale(locale) {
  if (!enabledLocales) {
    enabledLocales = {};

    _.each(nodeca.config.locales.enabled, function (str) {
      enabledLocales[parseLocale(str)] = str;
    });
  }

  return enabledLocales[parseLocale(locale)];
}


// find the best matching locale from the list or fall back to default
//
function findBestLocale(locales) {
  var locale;

  while (!locale && locales.length) {
    locale = getLocale(locales.shift());
  }

  return locale || nodeca.config.locales['default'];
}


////////////////////////////////////////////////////////////////////////////////


nodeca.filters.before('', { weight: -65 }, function preset_locale(params, callback) {
  if (this.user) {
    this.runtime.locale = findBestLocale([this.user.locale || '']);
    callback();
    return;
  }

  if (this.session) {
    this.runtime.locale = findBestLocale([this.session.locale || '']);
    callback();
    return;
  }

  // TODO: parse req.headers['accept-language'] to choose best locale for user
  this.runtime.locale = nodeca.config.locales['default'];
  callback();
});
