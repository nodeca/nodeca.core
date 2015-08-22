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
    parser.bus.before('render', { priority: -100 }, function add_table_classes(data) {
      data.ast.find('table').addClass('table table-striped');
    });
  };
};
