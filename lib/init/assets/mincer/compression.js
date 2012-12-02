"use strict";


/*global nodeca*/


// stdlib
var fs      = require('fs');
var path    = require('path');
var crypto  = require('crypto');


// 3rd-party
var uglify      = require('uglify-js');
var Csso        = require('csso');
var FsTools     = require('nlib').Vendor.FsTools;


////////////////////////////////////////////////////////////////////////////////

var CACHE_DIR = path.join(nodeca.runtime.apps[0].root, 'public/assets/.cache');
var UGLIFY_CFG = {
  gen_options: {
    beautify:     ('development' === nodeca.runtime.env),
    indent_level: 2
  }
};
var SALT = nodeca.runtime.env + JSON.stringify(require('../../../../package.json'));


////////////////////////////////////////////////////////////////////////////////


var debug = function () {};


if (/(?:^|,)all|assets-compression(?:,|$)/.test(process.env.NODECA_DEBUG)) {
  debug = function debug(result, file, mime) {
    console.log('[NODECA DEBUG] [ASSETS COMPRESSION] *** (%s) *** %s [%s]',
                result, file, mime);
  };
}


// dummy helper to generate md5 hash of a `str`
//
function hash(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}


// returns digest and data for the given key
//
function get_cache(digest) {
  var cached, filename = CACHE_DIR + '/' + digest;

  if (fs.existsSync(filename)) {
    cached = fs.readFileSync(filename, 'utf8');
  }

  return cached;
}


// sets digest and data for the given key
//
function set_cache(digest, compressed, callback) {
  var filename = CACHE_DIR + '/' + digest;

  FsTools.mkdir(path.dirname(filename), function (err) {
    if (err) {
      callback(err);
      return;
    }

    try {
      fs.writeFileSync(filename, compressed, 'utf8');
    } catch (err) {
      callback(err);
      return;
    }

    callback();
  });
}


// returns function that runs `compressor(data)` only in case if data changed
// since it was last time cached
//
function cachable(compressor) {
  return function (context, data, callback) {
    var digest  = path.basename(context.logicalPath) + '.' + hash(data + SALT),
        cached  = get_cache(digest),
        compressed;

    if (cached) {
      debug('CACHE HIT', context.logicalPath, context.contentType);
      callback(null, cached);
      return;
    }

    try {
      debug('CACHE MISS', context.logicalPath, context.contentType);
      compressed = compressor(data);
    } catch (err) {
      callback(err);
      return;
    }

    set_cache(digest, compressed, function (err) {
      callback(err, compressed);
    });
  };
}


function annotateUglifyError(err, str) {
  var message = 'UglifyJS error on line ' + err.line + '\n\n';
  var start   = err.line - 4;
  var stop    = err.line + 3;

  return message + str.split('\n').slice(start, stop).map(function (l, i) {
    return (start + i) + ':  ' + l;
  }).join('\n');
}


// JavaScript compressor
function js_compressor(str) {
  try {
    return uglify(str, UGLIFY_CFG);
  } catch (err) {
    throw new Error(annotateUglifyError(err, str));
  }
}


// CSS compressor
function css_compressor(str) {
  return Csso.justDoIt(str);
}


////////////////////////////////////////////////////////////////////////////////


module.exports.js   = cachable(js_compressor);
module.exports.css  = cachable(css_compressor);
