// Load `date` helper translations from cldr data
//
// This implementation is preliminary. Objects structure and merge logic
// can be changed, when more cldr data needed.
//
'use strict';


const _      = require('lodash');
const crypto = require('crypto');


module.exports = function (N) {

  N.wire.before('init:bundle', function init_date_l10n_cldr() {
    let cldr_locales_names = require('cldr-core/availableLocales').availableLocales.modern;

    //
    // Search cldr locales for enabled ones and load data
    //
    N.config.locales.forEach(locale => {
      // try to search full match first
      let name = cldr_locales_names.find(
        n => n.toLowerCase().replace(/[_]/g, '-') === locale.toLowerCase().replace(/[_]/g, '-'));

      // try to search by cutted names, if full ones not found
      if (!name) {
        name = cldr_locales_names.find(
          n => n.toLowerCase().split(/[-_]/g)[0] === locale.toLowerCase().split(/[-_]/g)[0]);
      }

      let data = require(`cldr-dates-modern/main/${name}/ca-gregorian`).main[name];

      let result = {};

      // Filter required cldr branches
      [
        'dates.calendars.gregorian.months.format.wide',
        'dates.calendars.gregorian.months.format.abbreviated',
        'dates.calendars.gregorian.months.stand-alone.wide',
        'dates.calendars.gregorian.months.stand-alone.abbreviated',
        'dates.calendars.gregorian.days.format.wide',
        'dates.calendars.gregorian.days.format.abbreviated',
        'dates.calendars.gregorian.days.stand-alone.wide',
        'dates.calendars.gregorian.days.stand-alone.abbreviated'
      ].forEach(key => _.set(result, key, _.get(data, key)));

      _.set(N.config.i18n, locale + '.l10n.=cldr', result);
    });

    N.version_hash = crypto.createHash('md5')
                        .update(N.version_hash)
                        .update(JSON.stringify(N.config.i18n, null, 2))
                        .digest('hex');
  });
};
