// Register `date` helper
//
'use strict';


var DateFormatter = require('nodeca.core/lib/system/date_formatter');


var dateFormatterCache = {};


// Converts `date` (Date|String|Timestamp) to specified format
//
function date_helper(date, formatName) {
  var locale = this.runtime.locale || this.__N.config.locales['default'];

  // Actually, we have to calculate timezone correction for specified date,
  // but diff for current time is enougth and much more simple.
  var tzDiff = new Date().getTimezoneOffset() - this.req.tzOffset;

  if (!dateFormatterCache[locale]) {
    dateFormatterCache[locale] = new DateFormatter(
      this.t('@l10n.date_formats'),
      this.t('@l10n.cldr').dates
    );
  }

  return dateFormatterCache[locale].format(date, formatName || 'relative', tzDiff);
}


module.exports = function () {
  require('nodeca.core/lib/system/env').helpers.date = date_helper;
};
