// Table parser plugin
//
'use strict';


module.exports = function () {

  return function (parser) {
    parser.md.enable('table');


    // Add table classes in the document, assuming that table tags
    // could only come from markdown markup at this point.
    //
    // It should be executed before all other renderer rules, because they
    // could add their own table tag in theory.
    //
    parser.bus.before('md2html.render', { priority: -100 }, function add_table_classes(data) {
      data.ast.find('table').addClass('table table-striped');
    });


    // Replace table tag to icon
    //
    parser.bus.before('html2preview.render', function replace_table_to_icon(data) {
      data.whitelist.push('span.icon.icon-table');

      data.ast.find('table').replaceWith('<span class="icon icon-table"></span>');
    });
  };
};
