// Wrapper to use jQuery or cheerio
//

'use strict';

var _require = require;
var window = this.window;

var cheequery;

// jQuery
if (window && window.$) {
  cheequery = window.$;

  cheequery.load = function (html) {
    return cheequery(html);
  };

// cheerio
} else {
  cheequery = _require('cheerio');
}

module.exports = cheequery;
