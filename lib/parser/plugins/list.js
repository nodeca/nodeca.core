// List parser plugin
//
'use strict';


module.exports = function () {

  return function (parser) {
    parser.md.enable('list');


    // Replace list tag to icon
    //
    parser.bus.before('html2preview.render', function replace_list_to_icon(data) {
      data.whitelist.push('span.icon.icon-list-bullet');
      data.whitelist.push('span.icon.icon-list-numbered');

      data.ast.find('ul').replaceWith('<span class="icon icon-list-bullet"></span>');
      data.ast.find('ol').replaceWith('<span class="icon icon-list-numbered"></span>');
    });
  };
};
