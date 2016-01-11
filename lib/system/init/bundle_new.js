'use strict';


const async         = require('async');
const _             = require('lodash');
const fs            = require('fs');
const path          = require('path');
const cluster       = require('cluster');
const BabelFish     = require('babelfish');
const Bundler       = require('nodeca.core/lib/bundler');
const routerInit    = require('./bundle_new/router');


const PROCESSING_QUEUE = [
  './bundle_new/setup',
  './bundle_new/create_components',
  './bundle_new/bin',
  './bundle_new/i18n',
  './bundle_new/views',
  './bundle_new/vendor',
  './bundle_new/js',
  './bundle_new/css',
  './bundle_new/client',
  './bundle_new/server',
  './bundle_new/compile',
  './bundle_new/map',
  './bundle_new/manifest'
].map(path => require(path));


module.exports = function (N) {

  function init_server(N, api_path_prefix, root_path, search_path, callback) {
    fs.readdir(search_path, (err, files) => {
      // Skip errors
      if (err) {
        callback();
        return;
      }

      async.each(files, (file, cb) => {
        let file_path = path.join(search_path, file);
        let stat;

        // Skip files starts with `_`
        if (_.startsWith(file, '_')) {
          cb();
          return;
        }

        try {
          stat = fs.statSync(file_path);
        } catch (e) {
          cb(e);
          return;
        }

        // Run recursive for directories
        if (stat.isDirectory()) {
          init_server(N, api_path_prefix, root_path, file_path, cb);
          return;
        }

        let init;

        try {
          init = require(file_path);
        } catch (e) {
          // Skip errors
          cb();
          return;
        }

        if (!_.isFunction(init)) {
          N.logger.warn(`Server module must return an initilizer function as the exports at ${file_path}`);
          cb();
          return;
        }

        let api_path_start = path.relative(root_path, search_path).replace(new RegExp(path.sep, 'g'), '.');
        let api_path;

        // user/album/album.js -> user.album
        // user/album.js -> user.album
        let path_obj = path.parse(file_path);

        if (path.parse(path_obj.dir).base === path_obj.name) {
          api_path = api_path_start;
        } else {
          api_path = api_path_start + '.' + path_obj.name;
        }

        init(N, api_path_prefix + api_path);
        cb();
      }, callback);
    });
  }


  // Init server methods
  //
  N.wire.before('init:bundle_new', function load_server(N, callback) {
    async.each(N.apps, (app, next) => {
      let server_path = path.join(app.root, 'server');

      init_server(N, 'server:', server_path, server_path, (err) => {
        if (err) {
          next(err);
          return;
        }

        let internal_path = path.join(app.root, 'internal');

        init_server(N, 'internal:', internal_path, internal_path, next);
      });
    }, callback);
  });


  // Router init
  //
  N.wire.before('init:bundle_new', function router_init(N) {
    routerInit(N);
  });


  // Process bundle queue
  //
  N.wire.on('init:bundle_new', function bundle_all(N, callback) {
    // In child process just load assets from manifest
    if (cluster.isWorker) {
      callback();
      return;
    }

    // In master process - compile assets (or rebuild outdated)
    const bundler = new Bundler({
      root: path.join(N.mainApp.root, 'assets')
    });

    let sandbox = { N, bundler };

    async.eachSeries(PROCESSING_QUEUE, (task, cb) => { task(sandbox, cb); }, callback);
  });


  // Load server assets
  //
  N.wire.after('init:bundle_new', function load_server_assets(N) {
    let manifest;
    let manifest_path = path.join(N.mainApp.root, 'assets', 'server', 'manifest.json');

    try {
      manifest = require(manifest_path);
    } catch (__) {}

    // Should never happens
    if (!manifest) {
      throw new Error("Bundle: Can't start process - manifest file not exists or broken.");
    }

    N.assets = manifest;
    N.i18n = new BabelFish();

    const server_assets = _.filter(manifest.files, (__, logical_path) => _.startsWith(logical_path, 'server/'));

    _.forEach(server_assets, (asset_info) => {
      // TODO: remove this check when components will be virtual
      if (_.startsWith(asset_info.digestPath, 'server/package-component-')) {
        return; // continue
      }

      let filename = path.join(N.mainApp.root, 'assets', asset_info.digestPath);
      let code = require(filename);

      if (_.isFunction(code)) {
        code(N);
      } else {
        N.logger.debug(`Server module ${filename} empty, skipping`);
      }
    });
  });

  // Create asset helpers
  //
  N.wire.after('init:bundle_new', function assets_helpers_add(N) {

    N.assets.asset_url = _.memoize(function (name) {
      // Relative paths not supported
      if (name[0] === '.') {
        N.logger.error(`Failed to find asset ${name}`);
        return '#';
      }

      var asset;

      try {
        // Try name directly first (matches are not resolveableit's not resolveable)
        asset = N.assets.files[name] || N.assets.files[require.resolve(name)];
      } catch (__) {}

      if (!asset) {
        N.logger.error(`Failed to find asset ${name}`);
        return '#';
      }

      return '/assets/' + asset.digestPath.replace(/^public\//, '');
    });


    let files_cache = {};

    _.mapValues(N.assets.files, (asset_info, logical_path) => {
      if (!_.startsWith(asset_info.digestPath, 'public/')) {
        return; // continue
      }

      files_cache[logical_path] = fs.readFileSync(path.join(N.mainApp.root, 'assets', asset_info.digestPath), 'utf8');
    });

    N.assets.asset_body = _.memoize(function (name) {
      // Relative paths not supported
      if (name[0] === '.') {
        N.logger.error(`Failed to find asset ${name}`);
        return null;
      }

      let asset_data = files_cache[require.resolve(name)];

      if (!asset_data) {
        N.logger.error(`Failed to find asset ${name}`);
        return null;
      }

      return asset_data;
    });
  });
};
