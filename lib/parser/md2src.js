'use strict';

var Remarkable = require('remarkable');

module.exports = function (data, callback) {

  var md = new Remarkable({
    html: false,
    linkify: true,
    typographer: true
  });

  md.inline.ruler.enable([ 'sub', 'sup' ]);

  data.output = md.render(data.input);

  callback();
};
