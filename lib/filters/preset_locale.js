'use strict';


/*global nodeca, _*/


var enabledLocales = {};


// returns array with `language`, `country`. `country` might not be presented
//
function parseLocale(str) {
  return str.match(/[a-z]+/gi).map(function (s) { return s.toLowerCase(); });
}


// fill in internal cache of enabled locales, which looks like:
//
//    { 'en,us': 'en-US', ... }
//
_.each(nodeca.config.locales.enabled, function (str) {
  enabledLocales[parseLocale(str)] = str;
});


// find the best matching locale from the list or fall back to default
//
function findBestLocale(locales) {
  var locale;

  while (!locale && locales.length) {
    locale = enabledLocales[parseLocale(locales.shift())];
  }

  return locale || nodeca.config.locales['default'];
}


////////////////////////////////////////////////////////////////////////////////


nodeca.filters.before('', { weight: -65 }, function preset_locale(params, callback) {
  if (this.is_member) {
    this.runtime.locale = findBestLocale([this.data.me.locale]);
    callback();
    return;
  }

  if (this.session) {
    this.runtime.locale = findBestLocale([this.session.locale]);
    callback();
    return;
  }

  // TODO: parse req.headers['accept-language'] to choose best locale for user
  this.runtime.locale = nodeca.config.locales['default'];
  callback();
});
