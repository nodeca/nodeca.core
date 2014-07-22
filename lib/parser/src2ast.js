'use strict';

var $ = require('./cheequery');


// Replace plain links to tags 'a'
//
function replace_plain_links(input) {
  return input.replace(/([^"'>]|p>)(https?:\/\/[^\s"'<]+)/gim, '$1<a href="$2"></a>');
}


module.exports = function (data, callback) {
  // TODO

  data.input = replace_plain_links(data.input);

  data.output = $.load(data.input);

  callback();
};
