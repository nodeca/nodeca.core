// Links parser plugin
//

'use strict';


module.exports = function () {

  return function (parser) {
    parser.md.enable([
      'link',
      'linkify'
    ]);

    parser.md.set({
      linkify: true
    });
  };
};
