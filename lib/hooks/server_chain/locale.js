// - get availavle locales on init stage
// - setup locale fromsession if exists
// - guess locale from browser if no session
//

'use strict';


var _ = require('lodash');


module.exports = function (N) {
  // returns "normalized" locale string:
  // - [^a-z] are replaced with dash `-`,
  // - all chars are lower-cased
  //
  // 'ru' -> 'ru'
  // 'ru_RU' -> 'ru-ru'
  // 'ru-UA' -> 'ru-ua'
  //
  function normalizeLocale(locale) {
    return String(locale).replace(/[^a-zA-Z]+/g, '-').toLowerCase();
  }


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
        if (enabledLocalesMap[l]) {
          return l;
        }
      }
    }

    return;
  }


  ////////////////////////////////////////////////////////////////////////////////


  // enabled locales map of `normalized -> original` pairs
  //
  //  { 'ru-ru': 'ru_RU', 'en': 'en' }
  //
  var enabledLocalesMap = {};

  // Fill enabled locales map on INIT stage.
  // (all i18n is done in bundler)
  //
  N.wire.after('init:bundle', function locales_list_fill(N, callback) {
    _.each(N.config.locales.enabled, function (locale) {
      var normalized = normalizeLocale(locale)   // e.g. 'en-us' or 'ru-ru'
        , languageId = normalized.split('-')[0]; // e.g. 'en' or 'ru'

      // Add full locale name to the map.
      enabledLocalesMap[normalized] = locale;

      // If it's the first locale in single language group (e.g. 'en'), make it
      // the default locale of this group. So 'en' may be be mapped to 'en-US'.
      if (!_.has(enabledLocalesMap, languageId)) {
        enabledLocalesMap[languageId] = locale;
      }
    });

    callback();
  });


  // - load locale from session if possible
  // - fallback to browser/default
  // - update session if exists
  //
  N.wire.before('server_chain:*', { priority: -65 }, function locale_inject(env, callback) {
    var locale;

    // First of all look for locale in the session.
    if (env.session && env.session.locale) {
      locale = env.session.locale;
    }

    // If not found, try to fetch it from plain cookies.
    if (!locale || !_.contains(N.config.locales.enabled, locale)) {
      locale = env.extras.getCookie('locale');
    }

    // At least try to detect locale from the browser preferences.
    if (!locale || !_.contains(N.config.locales.enabled, locale)) {
      locale = enabledLocalesMap[findAcceptedLanguage(env.origin.req)];
    }

    // If proper locale is still not found, fallback to the default one.
    if (!locale || !_.contains(N.config.locales.enabled, locale)) {
      locale = N.config.locales['default'];
    }

    env.runtime.locale = locale;

    // make sure next time we'll use locale from session directly.
    if (env.session) {
      env.session.locale = env.runtime.locale;
    }

    callback();
  });

};
