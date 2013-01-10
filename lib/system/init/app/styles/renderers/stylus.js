// Stylus Renderer.
//
// Exports single function with signature:
//
//    render(pathname, options, callback(err, compiledStr)) -> Void
//    - pathname (Pathname)
//    - options (Object)
//    - callback (Function)
//


'use strict';


// stdlib
var fs    = require('fs');
var path  = require('path');


// 3rd-party
var stylus = require('stylus');
var nib    = require('nib');


////////////////////////////////////////////////////////////////////////////////


module.exports = function (pathname, options, callback) {
  pathname.read(function (err, str) {
    var style, lookup;

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
    // monkey-patch lookup with resolver
    //

    lookup = stylus.utils.lookup;

    stylus.utils.lookup = function _lookup(pathname, paths, filename) {
      var
      match     = String(pathname).match(/^@([^\/]+)?\/(.+)$/),
      pkgName   = null,
      config    = null,
      files     = null,
      tmp       = null,
      re        = null;

      if (match) {
        pkgName = match[1] || options.pkgName;
        config  = (options.packages[pkgName] || {}).styles || {};
        files   = (config.files || []).map(function (p) { return String(p); });

        if (!path.extname(match[2])) {
          match[2] += ".styl";
        }

        re = new RegExp(match[2] + '$');

        while (files.length) {
          tmp = files.shift();

          if (re.test(tmp)) {
            return lookup(tmp, paths, filename);
          }
        }
      }

      return lookup(pathname, paths, filename);
    };

    //
    // render stylus file and restore lookup function
    //

    style.render(function (err, css) {
      stylus.utils.lookup = lookup;
      callback(err, css);
    });
  });
};
