// Stylus Renderer that understands `@[<pkgName>]/filename` imports.
//


'use strict';


var fs     = require('fs');
var path   = require('path');
var stylus = require('stylus');
var nib    = require('nib');


////////////////////////////////////////////////////////////////////////////////


// keep reference to original lookup function of stylus
var origLookup = stylus.utils.lookup;


////////////////////////////////////////////////////////////////////////////////


// render(pathname, options, callback(err, compiledStr)) -> Void
// - pathname (Pathname)
// - options (Object)
// - callback (Function)
//
module.exports = function (pathname, options, callback) {
  var str, style;

  try {
    str = fs.readFileSync(pathname, 'utf8');
  } catch (err) {
    callback(err);
    return;
  }

  style = stylus(str, {
    paths:    [ path.dirname(pathname) ],
    filename: pathname,
  });

  //
  // allow `@import "nib"`
  //

  style.use(nib());

  //
  // resolves `<node_module>/path/name` pathnames
  //

  function resolve(pathname) {
    pathname = String(pathname);

    if ('.' !== pathname[0]) {
      try {
        pathname = require.resolve(pathname);
      } catch (err) {
        // do nothing - stylus should report itself
      }
    }

    return pathname;
  }

  //
  // monkey-patch lookup with resolver
  //

  stylus.utils.lookup = function (_path, paths, filename) {
    return origLookup(resolve(_path), paths, filename);
  };

  //
  // render stylus file and restore lookup function
  //

  style.render(function (err, css) {
    stylus.utils.lookup = origLookup;
    callback(err, css);
  });
};
