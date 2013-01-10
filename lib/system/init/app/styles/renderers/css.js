// CSS Renderer.
//
// Exports single function with same signature as Stylus renderer, but that
// simply returns original string.
//


'use strict';


////////////////////////////////////////////////////////////////////////////////


// render(pathname, options, callback(err, compiledStr)) -> Void
// - pathname (Pathname)
// - options (Object)
// - callback (Function)
//
module.exports = function (pathname, options, callback) {
  pathname.read(callback);
};
