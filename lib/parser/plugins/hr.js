// HR parser plugin
//
'use strict';


module.exports = function () {

  return function (parser) {
    parser.md.enable('hr');


    // Remove hr
    //
    parser.bus.on('html2preview.render', function remove_hr(data) {
      data.ast.find('hr').remove();
    });
  };
};
