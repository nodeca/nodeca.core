'use strict';


var _ = require('lodash');


// prop names to access translations by index
//
var day_keys = [ 'sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat' ];

var REPLACE_RE = /%([a-z])/gi;

// Cast (Date|ISO-string|timestamp) to `Date` object
//
function castDate(date) {
  if (_.isDate(date)) { return date; }

  return String(date) === String(+date) ? new Date(+date) : new Date(date);
}

// Pad number to required length with specified character
//
function pad(num, count, padChar) {
  if (typeof padChar === 'undefined') { padChar = '0'; }

  return _.repeat(padChar, count - String(num).length) + num;
}


// List of intervals by priorities
var format_priorities = [
  'past_60s',
  'past_60m',
  'past_24h',
  'past_d',
  'past_1d',
  'future_60s',
  'future_60m',
  'future_24h',
  'future_d',
  'future_1d',
  'default'
];


function isToday(date) {
  return date.toDateString() === new Date().toDateString();
}

function isYesterday(date) {
  var now = new Date();
  return date.toDateString() === new Date(now.setDate(now.getDate() - 1)).toDateString();
}

function isTommorow(date) {
  var now = new Date();
  return date.toDateString() === new Date(now.setDate(now.getDate() + 1)).toDateString();
}

function matchInterval(date, intervalName) {
  var delta = (date.getTime() - Date.now()) / 1000;

  switch (intervalName) {
    case 'past_60s':
      if (delta <= 0 && delta > -60) { return true; }
      break;
    case 'past_60m':
      if (delta <= 0 && delta > -3600) { return true; }
      break;
    case 'past_24h':
      if (delta <= 0 && delta > -86400) { return true; }
      break;
    case 'past_d': // today, in past
      if (delta <= 0 && isToday(date)) { return true; }
      break;
    case 'past_1d':
      if (isYesterday(date)) { return true; }
      break;
    case 'future_60s':
      if (delta > 0 && delta < 60) { return true; }
      break;
    case 'future_60m':
      if (delta > 0 && delta < 3600) { return true; }
      break;
    case 'future_24h':
      if (delta > 0 && delta > 86400) { return true; }
      break;
    case 'future_d':
      if (delta > 0 && isToday(date)) { return true; }
      break;
    case 'future_1d':
      if (isTommorow(date)) { return true; }
      break;
    default:
      return false;
  }
}

////////////////////////////////////////////////////////////////////////////////

function DateFormatter(formats, cldr) {
  if (!(this instanceof DateFormatter)) {
    return new DateFormatter(formats, cldr);
  }
  this.cldr    = cldr.calendars.gregorian;
  this.formats = {};

  Object.keys(formats).forEach(function (name) {
    this.addFormat(name, formats[name]);
  }, this);
}


// Internal. Replace date formatting with values
// Similar to http://pubs.opengroup.org/onlinepubs/007908799/xsh/strftime.html,
// but without hardcoded formats
//
DateFormatter.prototype.__format_date__ = function __format_date__(date, pattern) {
  var self = this;

  return pattern.replace(REPLACE_RE, function (match, fmt) {
    var tmp;
    switch (fmt) {
      case 'a':
        return self.cldr.days.format.abbreviated[day_keys[date.getDay()]];
      case 'A':
        return self.cldr.days.format.wide[day_keys[date.getDay()]];
      case 'b':
      case 'h':
        return self.cldr.months.format.abbreviated[date.getMonth() + 1];
      case 'B':
        return self.cldr.months.format.wide[date.getMonth() + 1];
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
    return;
  }

  if (!_.isObject(config)) {
    throw new Error('DateFormatter: bad format definition, ' + config);
  }

  if (!config.default) {
    throw new Error('DateFormatter: missed `.default` format value, ' + config);
  }

  this.formats[name] = config;
};


// Format date according to specified config
//
// - date (Date|String|Number): Date instance, DateTime string or timestamp.
// - formatName (String): `iso`, `timestamp` or other, defined via constructor.
// - tzOffset (Number): TZ offset in minutes
//
DateFormatter.prototype.format = function format(date, formatName, tzOffset) {
  var d = castDate(date),
      i, interval, pattern;

  // Mandatory hardcoded formats
  if (formatName === 'iso') {
    return d.toISOString().slice(0, 19) + 'Z';
  }
  if (formatName === 'timestamp') {
    return d.getTime();
  }

  // Check available formats
  if (!this.formats[formatName]) {
    return '' + d.getTime() / 1000 + '*bad format: ' + formatName  + '*';
  }

  pattern = this.formats[formatName].default;

  for (i = 0; i < format_priorities.length; i++) {
    interval = format_priorities[i];

    if (this.formats[formatName][interval] && matchInterval(d, interval)) {
      pattern = this.formats[formatName][interval];
      break;
    }
  }

  return this.__format_date__(new Date(d.getTime() + (tzOffset || 0) * 60 * 1000), pattern);
};


module.exports = DateFormatter;
