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


  // parses Accept-Language header string into array of locales sorted by quality.
  // we limit amount of variant to maximum 10 elements.
  //
  //  'en;q=0.5,en-GB,en-US;q=0.8' -> [ 'en-gb', 'en-us', 'en' ]
  //
  function parseAcceptedLanguages(string) {
    var result, fallback;

    // Collect array of normalized locale names.
    result = _(String(string).split(',').slice(0, 10))
      .map(parseLanguagePart)
      .sortBy('quality')
      .pluck('locale')
      .valueOf();

    // Extract zone-less locale name, e.g. 'en'.
    fallback = _.last(result).split('-')[0];

    // Push the fallback if it not exists.
    if (fallback !== _.last(result)) {
      result.push(fallback);
    }

    return result;
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


  // Enabled locales map of `normalized -> original` pairs.
  //
  //   { 'ru-ru': 'ru-RU', 'en': 'en-US' }
  //
  var enabledLocalesMap = {};

  // Fill enabled locales map on INIT stage. (all i18n is done in bundler)
  //
  N.wire.after('init:bundle', function locales_list_fill(N) {

    // Add full locale names to the map.
    _.forEach(N.config.locales.enabled, function (locale) {
      enabledLocalesMap[normalizeLocale(locale)] = locale;
    });

    // Add zone-less locale aliases like 'en' for 'en-US'.
    _.forEach(N.config.locales.enabled, function (locale) {
      var languageId = normalizeLocale(locale).split('-')[0];

      if (!_.has(enabledLocalesMap, languageId)) {
        enabledLocalesMap[languageId] = locale;
      }
    });
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
