// List parser plugin
//
'use strict';


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
  };
};
