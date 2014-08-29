'use strict';

var $ = require('./cheequery');


// Replace smiles tags to source
//
function smiles2src(ast) {
  ast.find('span[data-nd-type="smile"]').each(function () {
    var $this = $(this);
    $this.replaceWith($this.data('nd-src'));
  });
}


// Replace spoiler tag to SRC
//
function spoiler2src(ast) {
  ast.find('div[data-nd-type="spoiler"]').each(function () {
    var $this = $(this);
    var $replacement = $('<spoiler>');

    $replacement
      .attr('title', $this.data('nd-title'))
      .append($this.find('.spoiler-content').contents());

    $this.replaceWith($replacement);
  });
}


module.exports = function (data, callback) {
  data.output = $.parse(data.input);

  smiles2src(data.output);
  spoiler2src(data.output);

  callback();
};
