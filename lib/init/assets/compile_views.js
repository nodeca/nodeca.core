'use strict';


/*global nodeca*/


// stdlib
var fs    = require('fs');
var path  = require('path');


// 3rd-party
var treeSet   = require('nlib').Support.tree.noCache.set;
var views     = require('nlib').Views;
var async     = require('nlib').Vendor.Async;
var _         = require('nlib').Vendor.Underscore;


// internal
var collectNamespaces = require('./namespaces').collect;


////////////////////////////////////////////////////////////////////////////////


// compileViews(root, callback(err)) -> Void
// - root (String): Pathname containing localized views directories.
// - callback (Function): Executed once everything is done.
//
// Compiles all localized views, inject them into `nodeca.runtime.views` for the
// server and writes browserified versions for each locale + namespace + theme
// tuple.
//
module.exports = function compileViews(root, callback) {
  var sources = {};

  nodeca.config.locales.enabled.forEach(function (locale) {
    _.keys(nodeca.config.themes.schemas).forEach(function (theme) {
      sources[path.join(root, 'views', locale, theme)] = {
        locale: locale,
        theme:  theme
      };
    });
  });

  async.forEach(_.keys(sources), function (pathname, nextSource) {
    var locale = sources[pathname].locale, theme = sources[pathname].theme;

    collectNamespaces(pathname, function (err, nsPaths) {
      if (err) {
        nextSource(err);
        return;
      }

      // nsPaths is a map of "namespace" => "list of path sources":
      // {
      //   users: [ '/tmp/nodeca.a30bec/views/en-US/desktop/users' ],
      //   admin: [ '/tmp/nodeca.a30bec/views/en-US/desktop/admin' ],
      //   ...
      // }

      async.forEach(_.keys(nsPaths), function (ns, nextNamespace) {
        views.collect(nsPaths[ns], function (err, tree) {
          if (err) {
            nextNamespace(err);
            return;
          }

          // set server-side views tree
          treeSet(
            nodeca.runtime.views,
            locale + '.' + theme + '.' + ns,
            views.buildServerTree(tree)
          );

          // write client-side views tree
          views.writeClientTree(
            path.join(root, 'compiled/views', locale, theme, ns + '.js'),
            tree,
            'this.nodeca.views.' + ns,
            nextNamespace
          );
        });
      }, nextSource);
    });
  }, callback);
};
