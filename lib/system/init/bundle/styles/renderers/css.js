// CSS Renderer.
//
// Exports single function with same signature as Stylus renderer, but that
// simply returns original string.
//


'use strict';


module.exports = function (data/*, filename */) {
  return {
    css: data,
    imports: []
  };
};
