// Emphasis parser plugin
//
'use strict';


const $ = require('../cheequery');


module.exports = function () {

  return function (parser) {
    parser.md.enable([ 'emphasis', 'strikethrough' ]);


    ///////////////////////////////////////////////////////////////////////////
    // Emphasis to preview
    //
    parser.bus.on('ast2preview', function replace_emphasis(data) {
      data.ast.find('strong, em, s').each(function () {
        $(this).replaceWith($(this).contents());
      });
    });
  };
};
