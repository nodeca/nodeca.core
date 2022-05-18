// Convert linefeed (\n) to <br>
//
'use strict';


module.exports = function () {

  return function (parser) {
    parser.md.set({ breaks: true });
  };
};
