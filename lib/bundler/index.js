'use strict';


const fs            = require('fs');
const fs_promises   = require('fs/promises');
const crypto        = require('crypto');
const path          = require('path');
const { promisify } = require('util');
const brotli        = promisify(require('zlib').brotliCompress);
const write         = require('write-file-atomic');


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
  'sass',
  'auto',
  'pug',
  'ejs',
  'handlebars',
  'macros',
  'autoprefixer',
  'terser',
  'clean-css'
].reduce((acc, name) => {
  acc[name] = require(path.join(__dirname, 'plugins', name));
  return acc;
}, {});


function Bundler(options) {
  if (!options) throw new Error('Bundler: missed constructor options');

  if (!options.root) throw new Error('Bundler: "root" should be defined');

  this.root = options.root;

  const opts = Object.assign({
    version: '',
    sourceMaps: true,
    brotli: false
  }, options);

  this.version = opts.version;
  this.sourceMaps = opts.sourceMaps;
  this.brotli = opts.brotli;

  this.__assets_classes__ = {};
  this.__plugins__ = {};

  for (let cls of asset_classes) this.registerAssetClass(cls);
  for (let [ name, fn ] of Object.entries(plugins)) this.registerPlugin(name, fn);

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
  get() {
    return crypto.createHash('md5').update(this.version, 'utf8');
  }
});


Bundler.prototype.getFileDigest = function (pathname) {
  const stat = this.stat(pathname);

  if (stat && stat.isDirectory()) {
    throw new Error(`Bundler: can't create digest on directory (${pathname})`);
  }

  // If file, digest the contents
  return this.hasher.update(this.readFile(pathname) || '').digest('hex');
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


// Compile assets and create manifest file
//
Bundler.prototype.compile = async function () {
  // Resolve public assets only. Dependencies will ve resolved automatically.
  const public_assets = Object.values(this.__assets__).filter(asset => !asset.virtual);

  // Resolve public assets
  await Promise.all(public_assets.map(asset => asset.resolve()));

  // Write assets
  await Promise.all(public_assets.map(async asset => {
    let target = path.join(this.root, asset.digestPath);

    try {
      await fs_promises.stat(target);
      // if no error - file exists, skip
      return;
    } catch (__) {}

    let buffer = asset.buffer;

    if (asset.sourceMap) {
      let comment;

      if (target.endsWith('.js')) {
        comment = Buffer.from('\n//# sourceMappingURL=' + path.basename(target) + '.map');
      } else if (target.endsWith('.css')) {
        comment = Buffer.from('\n/*# sourceMappingURL=' + path.basename(target) + '.map */');
      }

      if (comment) buffer = Buffer.concat([ buffer, comment ]);
    }

    await fs_promises.mkdir(path.dirname(target), { recursive: true });

    // Can be done in parallel

    await Promise.all([
      // Write asset
      write(target, buffer),

      // Write brotli compressed asset
      Promise.resolve().then(async () => {
        if (this.brotli &&
            asset.digestPath.startsWith('public/') &&
            (asset.digestPath.endsWith('.js') || asset.digestPath.endsWith('.css'))) {

          let res = await brotli(buffer);
          await write(target + '.br', res);
        }
      }),

      // Write source map
      Promise.resolve().then(async () => {
        let map = asset.sourceMap;

        if (!map) return;

        // eslint-disable-next-line func-style
        let patch_map_sources = map => {
          if (map.sections) {
            map.sections.forEach(s => patch_map_sources(s.map));
          } else {
            map.sources = map.sources.map(src => {
              if (src.startsWith(this.root)) {
                src = path.relative(this.root, src);

                let a = this.findAsset(src);
                if (!a) throw new Error(`Cannot find asset: ${src}`);

                // replace logicalPath for autogenerated assets with digestPath;
                // couldn't do it earlier because digest was not yet known
                src = path.resolve(this.root, a.digestPath);
              }

              // assume that assets are served as /assets/*.js,
              // and return relative path from root as `../nodeca_modules/nodeca.core/path/to/asset.js`
              return path.join('..', path.relative('./', src));
            });
          }
        };

        patch_map_sources(map);

        await write(target + '.map', JSON.stringify(map));
      })
    ]);
  }));


  let manifest = {};

  for (let [ path, asset ] of Object.entries(this.__assets__)) {
    if (!asset.resolved) continue;
    if (asset.virtual) continue;

    manifest[path] = {
      virtual: asset.virtual,
      digest: asset.digest,
      //dependencies: asset.dependencies,
      digestPath: asset.digestPath
    };
  }

  return manifest;
};


Bundler.DependencyError = Bundler.prototype.DependencyError = require('./utils/dependency_error');


module.exports = Bundler;
