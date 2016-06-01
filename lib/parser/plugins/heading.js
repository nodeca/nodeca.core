// Heading parser plugin
//
'use strict';


const $ = require('../cheequery');


module.exports = function () {

  return function (parser) {
    parser.md.enable([ 'heading', 'lheading' ]);


    ///////////////////////////////////////////////////////////////////////////
    // Replace heading to text
    //
    parser.bus.on('ast2preview', function replace_heading(data) {
      data.ast.find('h1, h2, h3, h4, h5, h6').each(function () {
        $(this).replaceWith($(this).contents());
      });
    });
  };
};
