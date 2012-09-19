'use strict';


/*global nodeca, _*/


// cache of enabled locales in form of `parsed locale` -> `original`
//
var enabledLocales;


// returns array with `language`, `country`. `country` might not be presented
//
//  'ru'    -> ['ru']
//  'ru_RU' -> ['ru', 'ru']
//  'ru-UA' -> ['ru', 'ua']
//
function parseLocale(str) {
  return (String(str).match(/[a-z]+/gi) || []).map(function (s) {
    return s.toLowerCase();
  });
}


// returns locale from the enabledLocales cache
//
//  'ru'    -> 'ru'
//  'ru_RU' -> 'ru-RU'
//  'ru-UA' -> undefined
//
function getLocale(locale) {
  if (!enabledLocales) {
    enabledLocales = {};

    // prepare a cache of "unified keys" => "locale" pairs
    //
    //  { 'en,us': 'en-US', ... }
    //
    _.each(nodeca.config.locales.enabled, function (str) {
      enabledLocales[parseLocale(str)] = str;
    });
  }

  return enabledLocales[parseLocale(locale)];
}


// find the first matching locale from the list
//
function findLocale(locales) {
  var locale;

  while (!locale && locales.length) {
    locale = getLocale(locales.shift());
  }

  return locale;
}


// find first matching locale from the list of accepted languages
//
function findAcceptedLocale(req) {
  var locales;

  if (req.headers && req.headers['accept-language']) {
    locales = String(req.headers['accept-language']).split(',').map(function (l) {
      return String(l.split(';')[0]);
    });

    return findLocale(locales);
  }
}


////////////////////////////////////////////////////////////////////////////////


nodeca.filters.before('', { weight: -65 }, function preset_locale(params, callback) {
  var locales = [];

  if (this.session && this.session.locale) {
    locales.push(getLocale(this.session.locale));
  }

  if (this.user && this.user.locale) {
    locales.push(getLocale(this.user.locale));
  }

  this.runtime.locale = findLocale(locales) ||
    findAcceptedLocale((this.origin.http || this.origin.rpc || {}).req) ||
    nodeca.config.locales['default'];

  callback();
});
