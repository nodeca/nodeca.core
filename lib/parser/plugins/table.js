// Table parser plugin
//

'use strict';


module.exports = function () {

  return function (parser) {
    parser.md.enable('table');
  };
};
