'use strict';


/*global N, underscore*/


// 3rd-party
var _ = underscore;


// enabled locales map of `normalized -> original` pairs
//
//  { 'ru-ru': 'ru_RU', 'en': 'en' }
//
var enabledLocales = {};


// returns "normalized" locale string:
// - [^a-z] are replaced with dash `-`,
// - all chars are lower-cased
//
//  'ru'    -> 'ru'
//  'ru_RU' -> 'ru-ru'
//  'ru-UA' -> 'ru-ua'
//
function normalizeLocale(str) {
  return String(str).replace(/[^a-zA-Z]+/g, '-').toLowerCase();
}


//
// fill enabled locales map on INIT stage via init hook
//


N.hooks.init.after('translations', function (next) {
  _.each(N.config.locales.enabled, function (str) {
    var normalized = normalizeLocale(str);
    enabledLocales[normalized] = str;
  });

  next();
});


// RegExp used to extract language quality
//
var QUALITY_RE = /^q=(.+)/;


// returns object with `locale` (normalized) and `quality` from `str`
//
//  'en; q=0.5' -> { locale: 'en', quality: 0.5 }
//  'en_US'     -> { locale: 'en-us', quality: 1 }
//
function parseLanguagePart(str) {
  var arr, match;

  // remove any whitespace that might appear according to RFC:
  // http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.4
  arr   = str.replace(/\s+/g, '').split(';');
  match = QUALITY_RE.exec(arr[1]);

  return {
    locale:   normalizeLocale(arr[0]),
    quality:  match ? +match[1] : 1
  };
}


// callback for Array#sort to sort languages (repecting quality param)
//
function sortLanguages(a, b) {
  if (a.quality === b.quality) {
    return 0;
  }

  // reverse-order sorting (q=1 has priority over q=0.5)
  return (a.quality > b.quality) ? -1 : 1;
}


// returns `locale` value of the object, to map `array` of lang objects into
// array of language strings. used as Array#map callback.
//
function pluckLanguages(obj) {
  return obj.locale;
}


// parses Accept-Language header string into array of locales sorted by quality.
// we limit amount of variant to maximum 10 elements.
//
//  'en;q=0.5,en-GB,en-US;q=0.8' -> [ 'en-gb', 'en-us', 'en' ]
//
function parseAcceptedLanguages(str) {
  return String(str).split(',')
    .slice(0, 10)
    .map(parseLanguagePart)
    .sort(sortLanguages)
    .map(pluckLanguages);
}


// find first matching locale from the list of accepted languages
//
function findAcceptedLanguage(req) {
  var locales, l;

  if (req && req.headers && req.headers['accept-language']) {
    locales = parseAcceptedLanguages(req.headers['accept-language']);
    while (locales.length) {
      l = locales.shift();
      if (enabledLocales[l]) {
        return l;
      }
    }
  }

  return;
}


////////////////////////////////////////////////////////////////////////////////


N.wire.before('server:**', { priority: -65 }, function preset_locale(env, callback) {
  var locale;

  if (env.session && env.session.locale) {
    locale = normalizeLocale(env.session.locale);
  }

  if (!locale || !enabledLocales[locale]) {
    // when there's no session or locale in session, try get desired locale
    locale = findAcceptedLanguage((env.origin.http || env.origin.rpc || {}).req);
  }

  env.runtime.locale = enabledLocales[locale] || N.config.locales['default'];

  if (env.session) {
    // make sure next time we'll use locale from session directly.
    env.session.locale = env.runtime.locale;
  }

  callback();
});
