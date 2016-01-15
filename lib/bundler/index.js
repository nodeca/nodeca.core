'use strict';


const zlib    = require('zlib');
const mkdirp  = require('mkdirp');
const fs      = require('fs');
const crypto  = require('crypto');
const _       = require('lodash');
const path    = require('path');
const async   = require('async');


const asset_classes = [
  require('./assets/concat'),
  require('./assets/lang'),
  require('./assets/file')
];


const plugins = [
  'load_bin',
  'load_text',
  'wrapper',
  'stylus',
  'less',
  'auto',
  'jade',
  'macros',
  'autoprefixer',
  'uglifyjs',
  'csswring'
].reduce((acc, name) => {
  acc[name] = require(path.join(__dirname, 'plugins', name));
  return acc;
}, {});


function Bundler(options) {
  if (!options) {
    throw new Error('Bundler: missed constructor options');
  }

  if (!options.root) {
    throw new Error('Bundler: "root" should be defined');
  }

  this.root = options.root;

  const opts = _.defaults({}, options, {
    version: '',
    sourceMaps: false,
    compress: false
  });

  this.version = opts.version;
  this.sourceMaps = opts.sourceMaps;
  this.compress = opts.compress;

  this.__assets_classes__ = {};
  this.__plugins__ = {};

  asset_classes.forEach(cls => { this.registerAssetClass(cls); });
  _.forEach(plugins, (fn, name) => { this.registerPlugin(name, fn); });

  this.__helpers__ = {};
  this.__assets__ = {};

  this.cache = {
    get: (key, cb) => {
      cb();
    },
    put: (key, val, opt, cb) => {
      cb();
    }
  };
}


Bundler.prototype.registerHelper = function (name, fn) {
  this.__helpers__[name] = fn;
};


Bundler.prototype.registerPlugin = function (name, fn) {
  this.__plugins__[name] = fn;
};


Bundler.prototype.findAsset = function (path) {
  return this.__assets__[path];
};


Bundler.prototype.registerAssetClass = function (cls) {
  this.__assets_classes__[cls.type] = cls;
};


Bundler.prototype.createClass = function (name, options) {
  if (this.findAsset(options.logicalPath)) {
    throw new Error(`Bundler: asset "${options.logicalPath}" already exists`);
  }

  if (!this.__assets_classes__[name]) {
    throw new Error(`Bundler: asset class "${name}" not found`);
  }

  const asset = new this.__assets_classes__[name](this, options);

  this.__assets__[asset.logicalPath] = asset;

  return asset;
};


Object.defineProperty(Bundler.prototype, 'hasher', {
  get: function () {
    return crypto.createHash('md5').update(this.version, 'utf8');
  }
});


Bundler.prototype.getFileDigest = function (pathname) {
  const stat = this.stat(pathname);

  if (stat && stat.isDirectory()) {
    throw new Error(`Bundler: can't create digest on directory (${pathname})`);
  }

  // If file, digest the contents
  return this.hasher.update(this.readFile(pathname)).digest('hex');
};


Bundler.prototype.stat = function (pathname) {
  try {
    return fs.statSync(pathname);
  } catch (err) {
    if (err.code !== 'ENOENT') { throw err; }
  }

  return null;
};


Bundler.prototype.readFile = function (filename, encoding) {
  encoding = encoding || null;
  try {
    return fs.readFileSync(filename, encoding);
  } catch (__) {}

  return null;
};


// Write data String/Buffer into filename
//
function write(filename, mtime, data, callback) {
  const temp_name = filename + '+';

  async.series([
    cb => mkdirp(path.dirname(filename), cb),

    cb => fs.writeFile(temp_name, Buffer.isBuffer(data) ? data : new Buffer(data), cb),

    cb => fs.rename(temp_name, filename, err => {
      // Try to remove tmp file on error. Don't check if exists, just suppress errors
      if (err) { try { fs.unlinkSync(temp_name); } catch (__) {} }
      cb(err);
    }),

    cb => fs.utimes(filename, mtime, mtime, err => {
      // Try to remove tmp file on error. Don't check if exists, just suppress errors
      if (err) { try { fs.unlinkSync(temp_name); } catch (__) {} }
      cb(err);
    })
  ], callback);
}


// Compile assets and create manifest file
//
Bundler.prototype.compile = function (callback) {
  // Resolve public assets only. Dependencies will ve resolved automatically.
  const public_assets = _.values(this.__assets__).filter(asset => !asset.virtual);

  async.series([
    // Resolve public assets
    cb => async.each(public_assets, (asset, next) => asset.resolve(next), cb),

    // Write assets
    cb => {
      async.each(public_assets, (asset, next) => {
        let target = path.join(this.root, asset.digestPath);

        try {
          fs.statSync(target);
          // if no error - file exists, skip
          next();
          return;
        } catch (__) {}

        let buffer = asset.buffer;

        if (this.sourceMaps && asset.sourceMap()) {
          buffer = Buffer.concat([ buffer, new Buffer(asset.mappingUrlComment()) ]);
        }

        async.parallel([

          // Write asset
          cb => write(target, asset.mtime || Date.now(), buffer, cb),

          // Write gzipped asset
          cb => {
            if (!this.compress) {
              cb();
              return;
            }

            zlib.gzip(buffer, function (err, res) {
              if (err) {
                cb(err);
                return;
              }

              write(target + '.gz', asset.mtime, res, cb);
            });
          },

          // Write source map
          cb => {
            if (!asset.sourceMap()) {
              cb();
              return;
            }

            // add XSSI protection header
            write(target + '.map', asset.mtime, ')]}\'\n' + asset.sourceMap(), cb);
          },

          // Write gzipped source map
          cb => {
            if (!asset.sourceMap() || !this.__options__.compress) {
              cb();
              return;
            }

            zlib.gzip(')]}\'\n' + asset.sourceMap(), function (err, res) {
              if (err) {
                cb(err);
                return;
              }

              write(target + '.map.gz', asset.mtime, res, cb);
            });
          }
        ], next);

      }, cb);
    }

  ], (err) => {
    if (err) {
      callback(err);
      return;
    }

    let manifest = _.chain(this.__assets__)
                    .pick(asset => asset.resolved)
                    .pick(asset => !asset.virtual)
                    .mapValues(asset => _.pick(asset, [
                      'virtual',
                      'digest',
                      // 'dependencies',
                      'digestPath'
                    ]))
                    .valueOf();

    callback(null, manifest);
  });
};


Bundler.DependencyError = Bundler.prototype.DependencyError = require('./utils/dependency_error');


module.exports = Bundler;
