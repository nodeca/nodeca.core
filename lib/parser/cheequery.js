// Wrapper to use jQuery or cheerio
//

'use strict';

var _require = require;

var cheequery;

/* global $ */

// If global jquery object detected - use it
if (typeof $ !== 'undefined') {

  // Parse HTML with saving text nodes on top level
  $.parse = function (html) {
    return $('<root>' + html + '</root>');
  };

  // Get all tag attributes
  $.fn.attrs = function () {
    return this[0].attributes || {};
  };

  cheequery = $;

// No global jquery object - we are on server - use cheerio
} else {
  var cheerio = _require('cheerio');

  // Extend cheerio

  // Works similar as $.fn.prop() for 'tagName' argument
  cheerio.prototype.prop = function (prop) {
    if (prop === 'tagName' && this[0].name) {
      return this[0].name.toUpperCase();
    }

    return undefined;
  };

  // Get all tag attributes
  cheerio.prototype.attrs = function () {
    return this[0].attribs || {};
  };

  // Parse HTML with saving text nodes on top level
  cheerio.parse = function (html) {
    return cheerio.load(html).root();
  };

  cheequery = cheerio;
}

module.exports = cheequery;
