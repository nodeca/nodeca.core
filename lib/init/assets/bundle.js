'use strict';


/*global nodeca*/


// stdlib
var fs    = require('fs');
var path  = require('path');


// 3rd-party
var HashTree  = require('nlib').Support.HashTree;
var apify     = require('nlib').Support.apify;
var apiTree   = require('nlib').ApiTree;
var skinner   = require('nlib').Skinner;
var views     = require('nlib').Views;
var async     = require('nlib').Vendor.Async;
var _         = require('nlib').Vendor.Underscore;
var fstools   = require('nlib').Vendor.FsTools;
var JASON     = require('nlib').Vendor.JASON;


// PRIVATE /////////////////////////////////////////////////////////////////////


function write_compiled_locale(ns, locale, obj, file, callback) {
  var data =  'nodeca.runtime.i18n.load(' +
              JSON.stringify(locale) + ',' + JSON.stringify(ns) + ',' +
              JASON.stringify(obj) + ');';

  async.series([
    async.apply(fstools.mkdir, path.dirname(file)),
    async.apply(fs.writeFile, file, data)
  ], function (err/*, results */) {
    callback(err);
  });
}


function findNamespaces(part, callback) {
  var namespaces = {};

  async.forEach(nodeca.runtime.apps, function (app, next) {
    var pathname = path.join(app.root, part);

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

        _.each(list, function(file) {
          var ns = file.replace(new RegExp(path.extname(file) + '$', ''));

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


// PUBLIC INTERFACE ////////////////////////////////////////////////////////////


module.exports = function (root, callback) {
  async.series([
    function (next) {
      var namespaces = {};

      // browserify server namespaces
      _.each(nodeca.server, function (obj, ns) {
        namespaces[ns] = [apiTree.browserifyServerTree(obj, 'this.server.' + ns, {
          prefix: 'server.' + ns,
          method: 'nodeca.io.apiTree'
        })];
      });

      async.forEach(['client', 'shared'], function (part, nextPart) {
        findNamespaces(part, function (err, map) {
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
                namespaces[ns] = [];
              }

              namespaces[ns].push(str);
              nextNs();
            });
          }, nextPart);
        });
      }, function (err) {
        if (err) {
          next(err);
          return;
        }

        async.forEach(_.keys(namespaces), function (ns, nextNs) {
          var str = namespaces[ns].join('\n\n');

          async.series([
            async.apply(fstools.mkdir, path.join(root, 'system', ns)),
            async.apply(fs.writeFile, path.join(root, 'system', ns, 'api.js'), str)
          ], nextNs);
        }, next);
      });
    },
    //
    //
    // prepare compiled languages (of babelfish)
    ////////////////////////////////////////////////////////////////////////////
    function build_language_files(next) {
      nodeca.logger.debug('[STATIC BUNDLER] *** Build language files');

      async.forEach(nodeca.config.locales.enabled, function (lang, next_lang) {
        var data = nodeca.runtime.i18n.getCompiledData(lang);
        async.forEach(_.keys(data), function (ns, next_ns) {
          var file = path.join(root, 'system', ns, 'i18n', lang + '.js');
          write_compiled_locale(ns, lang, data[ns], file, next_ns);
        }, next_lang);
      }, next);
    },
    //
    //
    // process views and assets with skinner
    ////////////////////////////////////////////////////////////////////////////
    function process_assets_with_skinner(next) {
      var roots = [], skins = [];

      // prepare list of root dirs
      _.each(nodeca.runtime.apps, function (app) {
        roots.push(app.root);
      });

      // prepare list of theme configs
      _.each(nodeca.config.theme_schemas, function (config, id) {
        skins.push({
          id:         id,
          paths:      {assets: 'assets/' + id, views: 'views/' + id},
          parent_id:  config.inherits
        });
      });

      skinner.process(roots, skins, root, next);
    },
    //
    //
    // localize view
    ////////////////////////////////////////////////////////////////////////////
    function localize_views(next) {
      var views_path = path.join(root, 'views'),
          orig_path  = views_path + '-orig';

      async.series([
        async.apply(fstools.move, views_path, orig_path),
        async.apply(views.localize, orig_path, views_path,
                    nodeca.runtime.i18n, nodeca.config.locales.enabled),
        async.apply(fstools.remove, orig_path)
      ], function (err/*, result*/) {
        next(err);
      });
    },
    //
    //
    // compile Jade View templates
    ////////////////////////////////////////////////////////////////////////////
    function process_view_trees(next) {
      var paths = {};

      nodeca.config.locales.enabled.forEach(function (locale) {
        _.keys(nodeca.config.theme_schemas).forEach(function (theme) {
          paths[path.join(root, 'views', locale, theme)] = {
            locale: locale,
            theme:  theme
          };
        });
      });

      async.forEach(_.keys(paths), function (pathname, nextPathname) {
        var locale = paths[pathname].locale, theme = paths[pathname].theme;

        fs.readdir(pathname, function (err, namespaces) {
          if (err) {
            nextPathname(err);
            return;
          }

          async.forEach(namespaces, function (ns, nextNamespace) {
            views.collect(path.join(pathname, ns), function (err, tree) {
              if (err) {
                nextNamespace(err);
                return;
              }

              var server_api = locale + '.' + theme + '.' + ns;

              // set server-side views tree
              HashTree.set(nodeca.runtime.views, server_api, views.buildServerTree(tree));

              var client_out = path.join(root, 'views/views', locale, theme, ns + '.js');

              // write client-side views tree
              views.writeClientTree(client_out, tree, 'this.nodeca.views.' + ns, nextNamespace);
            });
          }, nextPathname);
        });
      }, next);
    }
  ], callback);
};
