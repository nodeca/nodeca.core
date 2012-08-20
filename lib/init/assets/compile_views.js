'use strict';


/*global nodeca*/


// stdlib
var fs    = require('fs');
var path  = require('path');


// 3rd-party
var HashTree  = require('nlib').Support.HashTree;
var views     = require('nlib').Views;
var async     = require('nlib').Vendor.Async;
var _         = require('nlib').Vendor.Underscore;


// internal
var collectNamespaces = require('./namespaces').collect;


////////////////////////////////////////////////////////////////////////////////


module.exports = function (root, callback) {
  var sources = {};

  nodeca.config.locales.enabled.forEach(function (locale) {
    _.keys(nodeca.config.theme_schemas).forEach(function (theme) {
      sources[path.join(root, 'views', locale, theme)] = {
        locale: locale,
        theme:  theme
      };
    });
  });

  async.forEach(_.keys(sources), function (pathname, nextSource) {
    var locale = sources[pathname].locale, theme = sources[pathname].theme;

    collectNamespaces(pathname, function (err, map) {
      if (err) {
        nextSource(err);
        return;
      }

      async.forEach(_.keys(map), function (ns, nextNamespace) {
        views.collect(map[ns], function (err, tree) {
          if (err) {
            nextNamespace(err);
            return;
          }

          // set server-side views tree
          HashTree.set(
            nodeca.runtime.views,
            locale + '.' + theme + '.' + ns,
            views.buildServerTree(tree)
          );

          // write client-side views tree
          views.writeClientTree(
            path.join(root, 'views/views', locale, theme, ns + '.js'),
            tree,
            'this.nodeca.views.' + ns,
            nextNamespace
          );
        });
      }, nextSource);
    });
  }, callback);
};
