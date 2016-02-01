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

  cheequery = cheerio;
}

module.exports = cheequery;
