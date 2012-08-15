"use strict";


/*global nodeca, _*/


// stdlib
var fs   = require('fs');
var path = require('path');


// 3rd-party
var Mincer = require('mincer');
var nib    = require('nib');
var JASON  = require('nlib').Vendor.JASON;


// NLib
var HashTree = require('nlib').Support.HashTree;


// internal
var compression = require('./assets/compression');


////////////////////////////////////////////////////////////////////////////////


// Prepares map of assets on per-namespace-theme-locale basis:
//
//  {
//    '<locale>.<theme>': {
//      '<namespace>' {
//        js: [],
//        css: []
//      },
//      ...
//    },
//    ...
//  }
function distribute_assets(assets) {
  var result = {};

  // Returns list of assets full URLs leaving only those that can be found:
  //
  //  get_filtered_assets(['app.js', 'foo.js']);
  //  // => ['/assets/app-d53ac2ece1c5badc9af338852201fbaf.js']
  function get_filtered_assets(arr) {
    var result = [];

    _.each(arr, function (logicalPath) {
      if (assets[logicalPath]) {
        result.push("/assets/" + assets[logicalPath]);
      }
    });

    return result;
  }

  _.each(nodeca.config.locales.enabled, function (locale) {
    _.each(nodeca.config.theme_schemas, function (theme, theme_id) {
      var key = (locale + '.' + theme_id);

      if (theme.enabled) {
        result[key] = {};

        result[key].lib = {
          // FIXME: Remove `lib` namespace from the assets map
          //
          // `lib` is a *special* namespace that will be removed once
          // bundler will start bundle it into common and admin app.js
          js: get_filtered_assets([
            'lib.js', 'views/' + locale + '/' + theme_id + '/layouts.js'
          ])
        };

        // FIXME: namespaces should be auto-generated using client and views tree
        ['common', 'admin', 'users', 'blogs', 'forum'].forEach(function (ns) {
          result[key][ns] = {
            // FIXME: CSS assets should be bundled on per-theme basis
            css:  get_filtered_assets([ns + '/app.css']),
            // FIXME: Each namespace should have exactly ONE file
            //
            // All assets bundled into file:
            //   <namespace>/<locale>-<theme>-app.js
            js:   get_filtered_assets([
              'views/' + locale + '/' + theme_id + '/' + ns + '.js',
              ns + '/i18n/' + locale + '.js',
              ns + '/api.js',
              ns + '/app.js'
            ])
          };
        });
      }
    });
  });

  return result;
}

////////////////////////////////////////////////////////////////////////////////


// set custom logger for the Mincer
Mincer.logger.use(nodeca.logger.getLogger('system'));


// helper to get list of files matching given `filters`
function get_compilable(filters, env) {
  var result = [];

  env.eachLogicalPath(filters, function (logicalPath) {
    result.push(logicalPath);
  });

  return result;
}


////////////////////////////////////////////////////////////////////////////////


// Mincer initailization middleware
//
// Sets `nodeca.runtime.assets.environment` property with link to initialized
// Mincer.Environment and `nodca.runtime.assets.manifest` with manifest data.
//
module.exports = function (next) {
  var files, ignore_list, env, manifest, assets_root;

  assets_root = path.resolve(nodeca.runtime.apps[0].root, 'public/assets');
  env         = new Mincer.Environment(nodeca.runtime.assets_path);
  files       = ['lib.js', 'loader.js', 'json2.js', 'es5-shim.js'];
  ignore_list = [/^faye-browser/, /\.jade$/];

  files.push('**/app.js', '**/app.css');
  files.push('**/api.js', '**/i18n/*.js', 'views/**.js');

  // function that mathces any non-js or non-css files
  files.push(function nonAsset(logicalPath) {
    var extname = path.extname(logicalPath),
        ignore  = _.any(ignore_list, function (re) {
          return re.test(logicalPath);
        });

    // - logicalPath should not be ignored
    // - extension must exist (e.g. logicalPath of `layout.ejs` is `layout`)
    // - extension must be anything but .js or .css
    return !(ignore || !extname || /\.(?:js|css)$/.test(extname));
  });


  // Provide some helpers to EJS and Stylus
  env.registerHelper({
    asset_path: function (pathname) {
      var asset = this.environment.findAsset(pathname);
      return !asset ? null : ("/assets/" + asset.digestPath);
    },
    nodeca: function (path) {
      return HashTree.get(nodeca, path);
    },
    jason: JASON.stringify
  });

  // Add some funky stuff to Stylus
  Mincer.StylusEngine.registerConfigurator(function (style) {
    style.use(nib());
    style.define('import-dir', require('../stylus/import-dir'));
  });


  // fill in paths
  env.appendPath(path.resolve(__dirname, '../../node_modules/faye/browser'));
  env.appendPath(path.resolve(__dirname, '../../../nlib/node_modules/pointer/browser'));
  env.appendPath(path.resolve(__dirname, '../../../nlib/node_modules/babelfish/browser'));

  _.each(nodeca.runtime.apps, function (app) {
    env.appendPath(path.join(app.root, 'assets/javascripts'));
    env.appendPath(path.join(app.root, 'assets/stylesheets'));
    env.appendPath(path.join(app.root, 'assets/vendor'));
  });

  env.appendPath('assets');
  env.appendPath('system');
  env.appendPath('views');


  // USAGE: SKIP_ASSETS_COMPRESSION=1 ./nodeca.js server
  if (!process.env.SKIP_ASSETS_COMPRESSION) {
    // set up compressors
    env.jsCompressor  = compression.js;
    env.cssCompressor = compression.css;
  }


  // once environment is configured,
  // it can be replaced with 'static' cache version
  env         = env.index;
  manifest    = new Mincer.Manifest(env, assets_root);


  // compile manifest
  manifest.compile(get_compilable(files, env), function (err, data) {
    if (err) {
      next(err);
      return;
    }

    nodeca.runtime.assets = {
      environment:  env,
      manifest:     data,
      map:          distribute_assets(data.assets)
    };

    next();
  });
};
