// CSS Renderer.
//
// Exports single function with same signature as Stylus renderer, but that
// simply returns original string.
//


'use strict';


var fs = require('fs');


////////////////////////////////////////////////////////////////////////////////


// render(pathname, options, callback(err, compiledStr)) -> Void
// - pathname (Pathname)
// - options (Object)
// - callback (Function)
//
module.exports = function (pathname, options, callback) {
  var str;

  try {
    str = fs.readFileSync(pathname);
    callback(null, str);
  } catch (err) {
    callback(err);
    return;
  }
};
