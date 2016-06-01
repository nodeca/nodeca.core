// Superscript parser plugin
//
'use strict';


const $ = require('../cheequery');


module.exports = function () {

  return function (parser) {
    parser.md.use(require('markdown-it-sup'));


    ///////////////////////////////////////////////////////////////////////////
    // Replace sup to text
    //
    parser.bus.on('ast2preview', function replace_sup(data) {
      data.ast.find('sup').each(function () {
        $(this).replaceWith($(this).prepend('^').contents());
      });
    });
  };
};
