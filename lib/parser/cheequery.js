// Wrapper to use jQuery or cheerio
//

'use strict';

var _require = require;

var cheequery;

/* global $, document */

// If global jquery object detected - use it
if (typeof $ !== 'undefined') {

  // Parse HTML with saving text nodes on top level
  $.parse = function (html) {
    // Wrap in the same way as cheerio does
    return $('<root>' + html + '</root>');
  };

  // Get next sibling
  $.fn.nextNode = function () {
    return this[0].nextSibling ? $(this[0].nextSibling) : null;
  };

  // Get prev sibling
  $.fn.prevNode = function () {
    return this[0].previousSibling ? $(this[0].previousSibling) : null;
  };

  // Get all tag attributes
  $.fn.attrs = function () {
    var attributes = this[0].attributes || [];
    var result = {};

    for (var i = 0; i < attributes.length; i++) {
      result[attributes[i].name] = attributes[i].value;
    }

    return result;
  };

  $.fn.textNodes = function () {
    return this.contents().filter(function() {
      return this.nodeType === 3;
    });
  };

  $.createTextNode = function (text) {
    return document.createTextNode(text);
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

    /*eslint-disable no-undefined*/
    return undefined;
  };

  // Get next sibling
  cheerio.prototype.nextNode = function () {
    return this[0].next ? cheerio(this[0].next) : null;
  };

  // Get prev sibling
  cheerio.prototype.prevNode = function () {
    return this[0].prev ? cheerio(this[0].prev) : null;
  };

  // Get all tag attributes
  cheerio.prototype.attrs = function () {
    return this[0].attribs || {};
  };

  cheerio.prototype.textNodes = function () {
    return this.contents().filter(function() {
      return this.type === 'text';
    });
  };

  cheerio.createTextNode = function (text) {
    // Create 'div' with text and get text node from it
    return cheerio('<div/>').text(text).contents()[0];
  };

  // Parse HTML with saving text nodes on top level
  cheerio.parse = function (html) {
    return cheerio.load(html).root();
  };

  cheequery = cheerio;
}

module.exports = cheequery;
