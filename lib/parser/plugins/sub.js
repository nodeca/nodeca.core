// Subscript parser plugin
//
'use strict';


const $ = require('../cheequery');


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
  };
};
