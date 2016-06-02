// Table parser plugin
//
'use strict';


const utils = require('../utils');
const $     = require('../cheequery');


module.exports = function () {

  return function (parser) {
    parser.md.enable('table');


    // Add table classes in the document, assuming that table tags
    // could only come from markdown markup at this point.
    //
    // It should be executed before all other renderer rules, because they
    // could add their own table tag in theory.
    //
    parser.bus.before('ast2html', { priority: -100 }, function add_table_classes(data) {
      data.ast.find('table').addClass('table table-striped');
    });


    ///////////////////////////////////////////////////////////////////////////
    // Replace table tag to icon
    //
    parser.bus.before('ast2preview', function replace_table_to_icon(data) {
      data.ast.find('table').replaceWith('<span class="icon icon-table"></span>');
    });


    ///////////////////////////////////////////////////////////////////////////
    // Get text length
    //
    parser.bus.on('ast2length', function calc_length(data) {
      data.ast.find('th, td').each(function () {
        data.result.text_length += utils.text_length($(this));
      });
    });
  };
};
