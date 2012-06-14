"use strict";


/*global nodeca, _*/


// stdlib
var fs      = require('fs');
var path    = require('path');
var crypto  = require('crypto');


// 3rd-party
var Mincer      = require('mincer');
var UglifyJS    = require('uglify-js');
var Csso        = require('csso');
var nib         = require('nib');
var FsTools     = require('nlib').Vendor.FsTools;


// NLib
var HashTree    = require('nlib').Support.HashTree;


////////////////////////////////////////////////////////////////////////////////


var COMPRESSION_CACHE_DIR = path.join(nodeca.runtime.apps[0].root,
                                      '.compression-cache');


////////////////////////////////////////////////////////////////////////////////


function get_compilable(filters, env) {
  var result = [];

  env.eachLogicalPath(filters, function (logicalPath) {
    result.push(logicalPath);
  });

  return result;
}


function sha1(str) {
  return crypto.createHash('sha1').update(str).digest('hex');
}


function get_compressor_cache(key) {
  var base = COMPRESSION_CACHE_DIR + '/' + key,
      cached = {};

  if (path.existsSync(base + '.data')) {
    cached.data = fs.readFileSync(base + '.data', 'utf8');
    cached.salt = fs.readFileSync(base + '.salt', 'utf8');
  }

  return cached;
}


function set_compressor_cache(key, salt, data, callback) {
  var base = COMPRESSION_CACHE_DIR + '/' + key;

  FsTools.mkdir(COMPRESSION_CACHE_DIR, function (err) {
    if (err) {
      callback(err);
      return;
    }

    try {
      fs.writeFileSync(base + '.data', data, 'utf8');
      fs.writeFileSync(base + '.salt', salt, 'utf8');
    } catch (err) {
      callback(err);
      return;
    }

    callback();
  });
}


function cachable_compressor(compressor) {
  return function (context, data, callback) {
    var key     = sha1(context.logicalPath + context.contentType),
        salt    = sha1(data),
        cached  = get_compressor_cache(key);

    if (cached.salt === salt) {
      callback(null, cached.data);
      return;
    }

    compressor(data, function (err, data) {
      if (err) {
        callback(err);
        return;
      }

      set_compressor_cache(key, salt, data, function (err) {
        callback(err, data);
      });
    });
  };
}


////////////////////////////////////////////////////////////////////////////////


module.exports = function (next) {
  var files, ignore_list, env, manifest, assets_root;

  assets_root = path.resolve(nodeca.runtime.apps[0].root, 'public/assets');
  env         = new Mincer.Environment(nodeca.runtime.assets_path);
  files       = ['lib.js', 'app.js', '*/app.js', 'app.css', '*/app.css', 'modernizr.custom.js'];
  ignore_list = [/^faye-browser/];

  // function that mathces any non-js or non-css files
  files.push(function nonAsset(logicalPath) {
    var extname = path.extname(logicalPath),
        ignore  = _.any(ignore_list, function (re) {
          return re.test(logicalPath);
        });

    return !(ignore || /\.(js|css)$/.test(extname));
  });


  // Provide some helpers to EJS and Stylus
  env.registerHelper({
    asset_path: function (pathname) {
      var asset = this.environment.findAsset(pathname);
      return asset ? ("/assets/" + asset.digestPath) : null;
    },
    version: function () {
      return nodeca.runtime.version;
    },
    env: function () {
      return nodeca.runtime.env;
    },
    config: function (part) {
      return !part ? nodeca.config : HashTree.get(nodeca.config, part);
    }
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
  env.appendPath('assets/js');
  env.appendPath('assets/css');
  env.appendPath('assets/vendor');


  env.jsCompressor = cachable_compressor(function compressJavascript(data, callback) {
    try {
      var ast = UglifyJS.parser.parse(data);

      ast = UglifyJS.uglify.ast_mangle(ast);

      // we do not squeezing, as it gives minimal reduces,
      // while takes way toooo much time

      callback(null, UglifyJS.uglify.gen_code(ast, {
        beautify:     ('development' === nodeca.runtime.env),
        indent_level: 2
      }));
    } catch (err) {
      callback(err);
    }
  });

  env.cssCompressor = cachable_compressor(function compressCss(data, callback) {
    try {
      callback(null, Csso.justDoIt(data));
    } catch (err) {
      callback(err);
    }
  });


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

    nodeca.runtime.assets = {environment: env, manifest: data};
    next();
  });
};
