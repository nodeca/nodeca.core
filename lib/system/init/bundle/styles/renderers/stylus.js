// Stylus Renderer that understands `@[<pkgName>]/filename` imports.
//


'use strict';


// stdlib
var path  = require('path');


// 3rd-party
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
  pathname.read(function (err, str) {
    var style;

    if (err) {
      callback(err);
      return;
    }

    style = stylus(str, {
      paths:    [pathname.dirname],
      filename: String(pathname),
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

    stylus.utils.lookup = function (path, paths, filename) {
      return origLookup(resolve(path), paths, filename);
    };

    //
    // render stylus file and restore lookup function
    //

    style.render(function (err, css) {
      stylus.utils.lookup = origLookup;
      callback(err, css);
    });
  });
};
