// Register `date` & `timetag` helpers and live update
//
'use strict';


var DateFormatter = require('nodeca.core/lib/system/date_formatter');


var dateFormatterCache;


// Converts `date` (Date|String|Timestamp) to specified format
//
function date_helper(date, formatName) {
  if (!dateFormatterCache) {
    // get real formats locale to have proper plural rules
    var formatLocale = N.i18n.getLocale(N.runtime.locale, 'l10n.date_formats');

    dateFormatterCache = new DateFormatter(
      N.runtime.t('l10n.date_formats'),
      // cldr data filled in `init:bunle.i18n.phrases` hook
      N.runtime.t('l10n.cldr').dates,
      formatLocale
    );
  }

  return dateFormatterCache.format(date, formatName || 'relative', 0);
}


// Generates <time> tag with given date and format
//
function timetag_helper(date, formatName) {
  return '<time datetime="' + date_helper(date, 'iso') + '"' +
         ' data-format="' + formatName + '"' +
         ' title="' + date_helper(date, 'datetime') + '">' +
         date_helper(date, formatName) +
         '</time>';
}


N.wire.once('init:assets', function avatar_helper_register() {
  N.runtime.render.helpers.date    = date_helper;
  N.runtime.render.helpers.timetag = timetag_helper;
});


N.wire.once('navigate.done', function setup_time_live_update() {
  setInterval(function time_live_update() {
    $('time').each(function () {
      var $el = $(this),
          format = $el.data('format'),
          date   = $el.attr('datetime');

      if (!format || !date) return;

      var text = date_helper(date, format);

      if ($el.html() === text) return;

      $el.html(text);
    });
  }, 1000);
});
