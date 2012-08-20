'use strict';


/*global nodeca, _*/


// stdlib
var fs    = require('fs');
var path  = require('path');


// 3rd-party
var apiTree   = require('nlib').ApiTree;
var async     = require('nlib').Vendor.Async;
var fstools   = require('nlib').Vendor.FsTools;


// internal
var collectNamespaces = require('./namespaces').collect;


////////////////////////////////////////////////////////////////////////////////


// internal
// browserifyNamespaces(callback(err, map)) -> Void
// - callback (Function): Executed once all namespaces were browserified
//
// Builds a map of `<namespace> -> <browserified_source>` pairs. Each value is a
// source of JavaScript file that populates `server`, `shared` and `client`
// trees of a `namespace`.
//
function browserifyNamespaces(callback) {
  var app_roots  = nodeca.runtime.apps.map(function (app) { return app.root; }),
      namespaces = {};

  // browserify server namespaces
  _.each(nodeca.server, function (obj, ns) {
    namespaces[ns] = apiTree.browserifyServerTree(obj, 'this.server.' + ns, {
      prefix: 'server.' + ns,
      method: 'nodeca.io.apiTree'
    });
  });


  async.forEach(['client', 'shared'], function (part, nextPart) {
    var pathnames = app_roots.map(function (root) { return path.join(root, part); });

    collectNamespaces(pathnames, function (err, map) {
      if (err) {
        nextPart(err);
        return;
      }

      async.forEach(_.keys(map), function (ns, nextNs) {
        apiTree.browserifySources(map[ns], 'this.' + part + '.' + ns, function (err, str) {
          if (err) {
            nextNs(err);
            return;
          }

          if (!namespaces[ns]) {
            namespaces[ns] = str;
          } else {
            namespaces[ns] += '\n\n' + str;
          }

          nextNs();
        });
      }, nextPart);
    });
  }, function (err) {
    callback(err, namespaces);
  });
}


////////////////////////////////////////////////////////////////////////////////


// buildApiTree(root, callback(err)) -> Void
// - root (String): Pathname where to save browserified api.js files.
// - callback (Function): Executed once everything is done.
//
// Browserifies all known namespaces and writes api.js for each one.
//
module.exports = function buildApiTree(root, callback) {
  browserifyNamespaces(function (err, namespaces) {
    if (err) {
      callback(err);
      return;
    }

    async.forEach(_.keys(namespaces), function (ns, next) {
      async.series([
        async.apply(fstools.mkdir, path.join(root, 'system', ns)),
        async.apply(fs.writeFile, path.join(root, 'system', ns, 'api.js'), namespaces[ns])
      ], next);
    }, callback);
  });
};
