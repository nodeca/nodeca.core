// Wrapper to use jQuery or cheerio
//

'use strict';

let cheequery;

/*global $*/

// If global jquery object detected - use it
if (typeof $ !== 'undefined') {

  // Parse HTML with saving text nodes on top level
  $.parse = function (html) {
    // Wrap in the same way as cheerio does
    return $('<root>' + html + '</root>');
  };

  cheequery = $;

// No global jquery object - we are on server - use cheerio
} else {
  let _require = require;
  let cheerio = _require('cheerio');

  // Parse HTML with saving text nodes on top level
  cheerio.parse = function (html) {
    return cheerio.load(html).root();
  };

  let cheerio_html = cheerio.prototype.html;

  // replace &#xAAA; with the corresponding character,
  // other escape sequences (e.g. &#000) are not processed
  /* eslint-disable no-inner-declarations */
  function decode_entities(entity, code) {
    code = parseInt(code, 16);

    // don't unescape ascii characters, assuming that all ascii characters
    // are encoded for a good reason
    if (code < 0x80) return entity;

    return String.fromCodePoint(code);
  }

  let entity_regexp = /&#x([0-9a-f]{1,6});/ig;

  // Workaround for cheerio issue:
  //  - https://github.com/cheeriojs/dom-serializer/issues/26
  //  - https://github.com/cheeriojs/cheerio/issues/466
  //
  // The problem is: cheerio entity-encodes all non-ascii characters. You can
  // disable it with `decodeEntities: false`, but then it doesn't encode
  // anything (even <>').
  //
  cheerio.prototype.html = function () {
    let result = cheerio_html.apply(this, arguments);

    if (typeof result === 'string') {
      result = result.replace(entity_regexp, decode_entities);
    }

    return result;
  };

  cheequery = cheerio;
}

module.exports = cheequery;
