'use strict';


const _         = require('lodash');
const babelfish = require('babelfish');


// prop names to access translations by index
//
const day_keys = [ 'sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat' ];

// Cast (Date|ISO-string|timestamp) to `Date` object
//
function castDate(date) {
  if (_.isDate(date)) return date;

  return String(date) === String(+date) ? new Date(+date) : new Date(date);
}

// Pad number to required length with specified character
//
function pad(num, count, padChar) {
  if (typeof padChar === 'undefined') padChar = '0';

  return _.repeat(padChar, count - String(num).length) + num;
}


// List of intervals by priorities
const format_priorities = [
  'now',
  'past_60s',
  'past_60m',
  'past_24h',
  'past_d',
  'past_1d',
  'past_7d',
  'past_30d',
  'past_M',
  'past_365d',
  'past_Y',
  'past',
  'future_60s',
  'future_60m',
  'future_24h',
  'future_d',
  'future_1d',
  'future_7d',
  'future_30d',
  'future_M',
  'future_365d',
  'future_Y',
  'future',
  'default'
];

const format_diffs = {
  past_60s:    -60,
  past_60m:    -3600,
  past_24h:    -86400,
  past_7d:    -86400 * 7,
  past_30d:    -86400 * 30,
  past_365d:   -86400 * 365,
  past:        -Infinity,
  future_60s:  60,
  future_60m:  3600,
  future_24h:  86400,
  future_7d:  86400 * 7,
  future_30d:  86400 * 30,
  future_365d: 86400 * 365,
  future:      Infinity
};


function isToday(date) {
  return date.toDateString() === new Date().toDateString();
}

function isYesterday(date) {
  let now = new Date();
  return date.toDateString() === new Date(now.setDate(now.getDate() - 1)).toDateString();
}

function isTomorrow(date) {
  let now = new Date();
  return date.toDateString() === new Date(now.setDate(now.getDate() + 1)).toDateString();
}

function isCurrentMonth(date) {
  let current_month_start = new Date().setDate(1);
  let orig_month_start = new Date(date).setDate(1);

  return current_month_start.toDateString() === orig_month_start.toDateString();
}

function isCurrentYear(date) {
  return date.getFullYear() === new Date().getFullYear();
}


function matchInterval(date, intervalName, now) {
  let delta = Math.floor((date.getTime() - now) / 1000);

  switch (intervalName) {
    case 'now':
      if (delta === 0) { return true; }
      break;
    case 'past_60s':
    case 'past_60m':
    case 'past_24h':
    case 'past_7d':
    case 'past_30d':
    case 'past_365d':
    case 'past':
      if (delta <= 0 && delta > format_diffs[intervalName]) return true;
      break;
    case 'past_d': // today, in past
      if (delta <= 0 && isToday(date)) return true;
      break;
    case 'past_1d':
      if (isYesterday(date)) { return true; }
      break;
    case 'past_M': // current month, in past
      if (delta <= 0 && isCurrentMonth(date)) return true;
      break;
    case 'past_Y': // current year, in past
      if (delta <= 0 && isCurrentYear(date)) return true;
      break;
    case 'future_60s':
    case 'future_60m':
    case 'future_24h':
    case 'future_7d':
    case 'future_30d':
    case 'future_365d':
    case 'future':
      if (delta > 0 && format_diffs[intervalName]) return true;
      break;
    case 'future_d':
      if (delta > 0 && isToday(date)) return true;
      break;
    case 'future_1d':
      if (isTomorrow(date)) return true;
      break;
    case 'future_M': // current month, in future
      if (delta > 0 && isCurrentMonth(date)) return true;
      break;
    case 'future_Y': // current month, in future
      if (delta > 0 && isCurrentYear(date)) return true;
      break;
    default:
      return false;
  }
  return false;
}

////////////////////////////////////////////////////////////////////////////////

function DateFormatter(formats, cldr, locale) {
  if (!(this instanceof DateFormatter)) {
    return new DateFormatter(formats, cldr);
  }
  this.cldr       = cldr.calendars.gregorian;
  this.formats    = {};
  this.locale     = locale || 'en';
  this.babelfish  = babelfish(this.locale);

  Object.keys(formats).forEach(name => this.addFormat(name, formats[name]));
}

const REPLACE_RE = /%(=[aAbBh]|[a-zA-Z])/g;

// Internal. Replace date formatting with values
// Similar to http://pubs.opengroup.org/onlinepubs/007908799/xsh/strftime.html,
// but without hardcoded formats
//
DateFormatter.prototype.__format_date__ = function __format_date__(date, pattern) {

  return pattern.replace(REPLACE_RE, (match, fmt) => {
    let tmp;

    switch (fmt) {
      case 'a':
        return this.cldr.days.format.abbreviated[day_keys[date.getDay()]];
      case 'A':
        return this.cldr.days.format.wide[day_keys[date.getDay()]];
      case 'b':
      case 'h':
        return this.cldr.months.format.abbreviated[date.getMonth() + 1];
      case 'B':
        return this.cldr.months.format.wide[date.getMonth() + 1];

      case '=a':
        return this.cldr.days['stand-alone'].abbreviated[day_keys[date.getDay()]];
      case '=A':
        return this.cldr.days['stand-alone'].wide[day_keys[date.getDay()]];
      case '=b':
      case '=h':
        return this.cldr.months['stand-alone'].abbreviated[date.getMonth() + 1];
      case '=B':
        return this.cldr.months['stand-alone'].wide[date.getMonth() + 1];

      case 'd':
        return pad(date.getDate(), 2);
      case 'e':
        return pad(date.getDate(), 2, ' ');
      case 'H':
        return pad(date.getHours(), 2);
      case 'I':
        return pad((tmp = date.getHours) > 12 ? tmp - 12 : tmp, 2);
      case 'k':
        return pad(date.getHours(), 2, ' ');
      case 'l':
        return pad((tmp = date.getHours) > 12 ? tmp - 12 : tmp, 2, ' ');
      case 'L':
        return pad(date.getMilliseconds(), 3);
      case 'm':
        return pad(date.getMonth() + 1, 2);
      case 'M':
        return pad(date.getMinutes(), 2);
      case 'n':
        return '\n';
      case 'p':
        return date.getHours() > 11 ? 'PM' : 'AM';
      case 'P':
        return (date.getHours() > 11 ? 'PM' : 'AM').toLowerCase();
      case 's':
        return Math.floor(date.getTime() / 1000);
      case 'S':
        return pad(date.getSeconds(), 2);
      case 't':
        return '\t';
      case 'u':
        return (tmp = date.getDay()) === 0 ? 7 : tmp;
      case 'w':
        return pad(date.getDay(), 2);
      case 'y':
        return String(date.getFullYear()).substring(2);
      case 'Y':
        return date.getFullYear();
      case 'z':
        tmp = Math.floor(-date.getTimezoneOffset() / 60);
        return (tmp > 0 ? '+' : '-') + pad(Math.abs(tmp), 4);
      default:
        return match;
    }
  });
};

DateFormatter.prototype.addFormat = function addFormat(name, config) {
  if (_.isString(config)) {
    this.formats[name] = { 'default': config };
    this.babelfish.addPhrase(this.locale, [ name, 'default' ].join('.'), config);
    return;
  }

  if (!_.isObject(config)) {
    throw new Error('DateFormatter: bad format definition, ' + config);
  }

  if (!config.default) {
    throw new Error('DateFormatter: missed `.default` format value, ' + config);
  }

  this.formats[name] = config;
  this.babelfish.addPhrase(this.locale, name, config);
};


// Format date according to specified config
//
// - date (Date|String|Number): Date instance, DateTime string or timestamp.
// - formatName (String): `iso`, `timestamp` or other, defined via constructor.
// - tzOffset (Number): TZ offset in minutes
//
DateFormatter.prototype.format = function format(date, formatName, tzOffset) {
  let d   = castDate(date),
      now = Date.now();

  // Mandatory hardcoded formats
  if (formatName === 'iso') {
    return d.toISOString().slice(0, 19) + 'Z';
  }
  if (formatName === 'ts' || formatName === 'timestamp') { // deprecate 'timestamp'
    return d.getTime();
  }

  // Check available formats
  if (!this.formats[formatName]) {
    return '' + d.getTime() / 1000 + '*bad format: ' + formatName  + '*';
  }

  let pattern = 'default';

  for (let i = 0; i < format_priorities.length; i++) {
    let interval = format_priorities[i];

    if (this.formats[formatName][interval] && matchInterval(d, interval, now)) {
      pattern = interval;
      break;
    }
  }

  let diff = Math.abs(Math.floor((d.getTime() - now) / 1000));

  let rel = {
    future:   d.getTime() - now > 0,
    seconds:  diff % 60,
    minutes:  Math.floor(diff / 60),
    hours:    Math.floor(diff / 3600),
    days:     Math.floor(diff / 86400),
    months:   Math.floor(diff / (86400 * 30)),
    years:    Math.floor(diff / (86400 * 365))
  };

  let translated = this.babelfish.t(this.locale, [ formatName, pattern ].join('.'), rel);

  return this.__format_date__(new Date(d.getTime() + (tzOffset || 0) * 60 * 1000), translated);
};


module.exports = DateFormatter;
