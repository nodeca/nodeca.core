// sub parser plugin
//

'use strict';


module.exports = function () {

  return function (parser) {
    parser.md.use(require('markdown-it-sub'));
  };
};
