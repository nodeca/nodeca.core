// Emphasis parser plugin
//
'use strict';


const $     = require('../cheequery');
const utils = require('../utils');


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


    ///////////////////////////////////////////////////////////////////////////
    // Get text length
    //
    parser.bus.on('ast2length', function calc_length(data) {
      data.ast.find('strong, em, s').each(function () {
        data.result.text_length += utils.text_length($(this));
      });
    });
  };
};
