// HR parser plugin
//
'use strict';


module.exports = function () {

  return function (parser) {
    parser.md.enable('hr');


    ///////////////////////////////////////////////////////////////////////////
    // Remove hr
    //
    parser.bus.on('ast2preview', function remove_hr(data) {
      data.ast.find('hr').remove();
    });
  };
};
