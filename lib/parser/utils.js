'use strict';


const charcount = require('charcount');


const SPACE_RE = /\s+/g;


// Children nodes text length (without spaces)
//
exports.text_length = function ($el) {
  let result = 0;

  $el.contents().each(function () {
    if (this.type === 'text') {
      result += charcount(this.data.replace(SPACE_RE, ''));
    }
  });

  return result;
};
