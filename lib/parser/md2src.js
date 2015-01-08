'use strict';

var MarkdownIt = require('markdown-it');

module.exports = function (data, callback) {

  var md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true
  });

  data.output = md.render(data.input);

  callback();
};
