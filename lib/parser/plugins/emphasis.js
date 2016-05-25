// Emphasis parser plugin
//
'use strict';


const $ = require('../cheequery');


module.exports = function () {

  return function (parser) {
    parser.md.enable([ 'emphasis', 'strikethrough' ]);


    // Replace emphasis to text
    //
    parser.bus.on('html2preview.render', function replace_emphasis(data) {
      data.ast.find('b, i, s, strong, em').each(function () {
        $(this).replaceWith($(this).contents());
      });
    });
  };
};
