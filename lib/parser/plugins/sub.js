// Subscript parser plugin
//
'use strict';


const $     = require('../cheequery');
const utils = require('../utils');


module.exports = function () {

  return function (parser) {
    parser.md.use(require('markdown-it-sub'));


    ///////////////////////////////////////////////////////////////////////////
    // Replace sub to text
    //
    parser.bus.on('ast2preview', function replace_sub(data) {
      data.ast.find('sub').each(function () {
        $(this).replaceWith($(this).contents());
      });
    });


    ///////////////////////////////////////////////////////////////////////////
    // Get text length
    //
    parser.bus.on('ast2length', function calc_length(data) {
      data.ast.find('sub').each(function () {
        data.result.text_length += utils.text_length($(this));
      });
    });
  };
};
