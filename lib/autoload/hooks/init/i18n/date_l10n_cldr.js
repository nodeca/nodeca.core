// Load `date` helper translations from cldr data
//
// This implementation is preliminary. Objects structure andmerge logic
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
    // Search cldr locales for enebled ones and load data
    //
    N.config.locales.enabled.forEach(function (locale) {
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

      // Pick manually, until lodash support it better
      var result = {
        dates: {
          calendars: {
            gregorian: {
              months: {
                format:        _.pick(data.dates.calendars.gregorian.months.format, [ 'wide', 'abbreviated' ]),
                'stand-alone': _.pick(data.dates.calendars.gregorian.months['stand-alone'], [ 'wide', 'abbreviated' ])
              },
              days: {
                format:        _.pick(data.dates.calendars.gregorian.days.format, [ 'wide', 'abbreviated' ]),
                'stand-alone': _.pick(data.dates.calendars.gregorian.days['stand-alone'], [ 'wide', 'abbreviated' ])
              }
            }
          }
        }
      };

      // Dirty but ok for now
      sandbox.i18n.addClientI18n(locale, 'l10n', 'l10n', { '=cldr': result });
    });
  });
};
