// CSS Renderer.
//
// Exports single function with same signature as Stylus renderer, but that
// simply returns original string.
//


'use strict';


////////////////////////////////////////////////////////////////////////////////


module.exports = function (pathname, options, callback) {
  pathname.read(callback);
};
