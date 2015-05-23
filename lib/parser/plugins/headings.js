// headings parser plugin
//

'use strict';


module.exports = function () {

  return function (parser) {
    parser.md.enable([ 'heading', 'lheading' ]);
  };
};
