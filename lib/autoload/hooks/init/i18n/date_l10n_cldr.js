// Load `date` helper translations from cldr data
//
// This implementation is preliminary. Objects structure and merge logic
// can be changed, when more cldr data needed.
//
'use strict';


var _ = require('lodash');


module.exports = function (N) {

  N.wire.on('init:bundle.i18n.phrases', function init_date_l10n_cldr(sandbox) {
    var cldr = _.merge(
      {},
      require('cldr-data/availableLocales'),
      require('cldr-data/supplemental/parentLocales')
    );

    var cldr_locales = {},
        cldr_locales_names;

    cldr.availableLocales.forEach(function (l) { cldr_locales[l] = l; });
    cldr_locales = _.merge(cldr_locales, cldr.supplemental.parentLocales.parentLocale);
    cldr_locales_names = Object.keys(cldr_locales);

    //
    // Search cldr locales for enabled ones and load data
    //
    N.config.locales.forEach(function (locale) {
      var name;

      // try to search full match first
      name = _.find(cldr_locales_names, function (n) {
        return n.toLowerCase().replace(/[_]/g, '-') === locale.toLowerCase().replace(/[_]/g, '-');
      });

      // try to search by cutted names, if full ones not found
      if (!name) {
        name = _.find(cldr_locales_names, function (n) {
          return n.toLowerCase().split(/[-_]/g)[0] === locale.toLowerCase().split(/[-_]/g)[0];
        });
      }

      var data = require('cldr-data/main/' + cldr_locales[name] + '/ca-gregorian')
                    .main[cldr_locales[name]];

      var result = {};

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
      ].forEach(function (key) {
        _.set(result, key, _.get(data, key));
      });

      _.set(sandbox.N.config.i18n, locale + '.l10n.=cldr', result);
    });
  });
};
