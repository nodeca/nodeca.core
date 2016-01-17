// Register `date` helper
//
'use strict';


const DateFormatter = require('nodeca.core/lib/system/date_formatter');


let dateFormatterCache = {};


// Converts `date` (Date|String|Timestamp) to specified format
//
function date_helper(date, formatName) {
  let locale = this.runtime.locale || this.__N.config.locales[0];

  // Actually, we have to calculate timezone correction for specified date,
  // but diff for current time is enougth and much more simple.
  let tzDiff = new Date().getTimezoneOffset() - this.req.tzOffset;

  if (!dateFormatterCache[locale]) {
    // get real formats locale to have proper plural rules
    let formatLocale = this.__N.i18n.getLocale(locale, 'l10n.date_formats');

    dateFormatterCache[locale] = new DateFormatter(
      this.t('@l10n.date_formats'),
      // cldr data filled in `init:bunle.i18n.phrases` hook
      this.t('@l10n.cldr').dates,
      formatLocale
    );
  }

  return dateFormatterCache[locale].format(date, formatName || 'relative', tzDiff);
}


// Generates <time> tag with given date and format
//
function timetag_helper(date, formatName) {

  return `<time datetime="${this.helpers.date(date, 'iso')}" data-format="${formatName}"` +
         ` title="${this.helpers.date(date, 'datetime')}">${this.helpers.date(date, formatName)}</time>`;
}


module.exports = function () {
  require('nodeca.core/lib/system/env').helpers.date    = date_helper;
  require('nodeca.core/lib/system/env').helpers.timetag = timetag_helper;
};
