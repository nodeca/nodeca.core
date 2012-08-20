"use strict";


/*global nodeca, _*/


// stdlib
var fs    = require('fs');
var path  = require('path');

// 3rd-party
var async = require('nlib').Vendor.Async;


////////////////////////////////////////////////////////////////////////////////


// collect(pathnames, callback(err, namespaces) -> Void
// - pathnames (String|Array): Path(s) to search for the namespaces
// - callback (Function): Executed once everything is done
//
// Searches for the namespaces within given list of pathnames. It's safe to pass
// a pathname that does not exists. But if it exists it must be a directory
// otherwise an error will be returned to the callback.
//
// If collection was successfull, callback will receive a map of namespace and
// it's sources pairs:
//
//    {
//      foo: [ '/path/to/app1/shared/foo', '/path/toapp2/foo.js' ],
//      bar: [ '/path/to/app1/shared/bar.js' ],
//      // ...
//    }
//
function collect(pathnames, callback) {
  var namespaces = {};

  pathnames = _.isArray(pathnames) ? pathnames : [pathnames];

  async.forEach(pathnames, function (pathname, next) {
    fs.exists(pathname, function (exists) {
      if (!exists) {
        next();
        return;
      }

      fs.readdir(pathname, function (err, list) {
        if (err) {
          next(err);
          return;
        }

        list.forEach(function (file) {
          var ns = file.replace(/\.js$/, '');

          if (0 <= ns.indexOf('.')) {
            // dots are not allowed for namespaces.
            // if file still have a dot, then it's one of:
            // - not a javascript file
            // - directory with non-valid namespace identifier
            return;
          }

          if (!namespaces[ns]) {
            namespaces[ns] = [];
          }

          namespaces[ns].push(path.join(pathname, file));
        });

        next();
      });
    });
  }, function (err) {
    callback(err, namespaces);
  });
}


////////////////////////////////////////////////////////////////////////////////


module.exports.collect = collect;
