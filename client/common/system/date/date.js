// Register `date` helper
//
'use strict';


var DateFormatter = require('nodeca.core/lib/system/date_formatter');


var dateFormatterCache;


// Converts `date` (Date|String|Timestamp) to specified format
//
function date_helper(date, formatName) {
  if (!dateFormatterCache) {
    dateFormatterCache = new DateFormatter(
      N.runtime.t('l10n.date_formats'),
      N.runtime.t('l10n.cldr').dates
    );
  }

  return dateFormatterCache.format(date, formatName || 'relative', 0);
}


N.wire.once('init:assets', function avatar_helper_register() {
  N.runtime.render.helpers.date = date_helper;
});
