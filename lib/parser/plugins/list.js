// List parser plugin
//
'use strict';


const utils = require('../utils');
const $     = require('../cheequery');


module.exports = function () {

  return function (parser) {
    parser.md.enable('list');


    ///////////////////////////////////////////////////////////////////////////
    // List to preview
    //
    parser.bus.before('ast2preview', function replace_list_to_icon(data) {
      // Replace list tag to icon
      data.ast.find('ul').replaceWith('<span class="icon icon-list-bullet"></span>');
      data.ast.find('ol').replaceWith('<span class="icon icon-list-numbered"></span>');
    });


    ///////////////////////////////////////////////////////////////////////////
    // Get text length
    //
    parser.bus.on('ast2length', function calc_length(data) {
      data.ast.find('li').each(function () {
        data.result.text_length += utils.text_length($(this));
      });
    });
  };
};
