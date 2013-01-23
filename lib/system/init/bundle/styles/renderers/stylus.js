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
    // resolves `@[<pkgName>]/foobar` pathnames:
    //
    //    @/test          --> replaces `@` with curent pkg root
    //    @common/foobar  --> replaces `@common` with common pkg root
    //

    function resolve(pathname) {
      var
      match     = String(pathname).match(/^@([^\/]+)?\/(.+)/),
      pkgName   = null,
      pkgConfig = null,
      files     = null,
      tmp       = null,
      re        = null;

      if (match) {
        pkgName   = match[1] || options.pkgName;
        pkgConfig = options.packages[pkgName] || {};
        files     = ((pkgConfig.styles || {}).files || []).map(String);

        if (!path.extname(match[2])) {
          match[2] += ".styl";
        }

        re = new RegExp(match[2] + '$');

        while (files.length) {
          tmp = files.shift();

          if (re.test(tmp)) {
            return tmp;
          }
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
