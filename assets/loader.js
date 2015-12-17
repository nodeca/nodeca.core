//= require vendor/modernizr.custom
//= require vendor/bag.js/bag.js
//= require_self


/*eslint-disable no-alert*/


(function (window) {
  'use strict';


  var NodecaLoader = window.NodecaLoader = { booted: false };
  var alert = window.alert;


  // Simple cross-browser `forEach` iterator for arrays.
  function forEach(array, iterator) {
    for (var index = 0; index < array.length; index += 1) {
      iterator(array[index], index);
    }
  }

  // Simple cross-browser replacement for `Array.reduce`
  function reduce(array, iterator, value) {
    for (var index = 0; index < array.length; index += 1) {
      value = iterator(value, array[index]);
    }

    return value;
  }

  function has(obj, prop) {
    return Object.prototype.hasOwnProperty.call(obj, prop);
  }

  function isFunction(object) {
    return Object.prototype.toString.call(object) === '[object Function]';
  }

  // Cached non-operable function.
  function noop() {}


  // Mapping of package names to package metadata for all available packages at
  // the currect locale. The metadata is an object consists of three keys:
  //
  //   `js`            - URL to bundle, containing this package's JS
  //   `css`           - URL to bundle, containing this package's CSS
  //   `packagesQueue` - sorted list of dependencies, including this
  //                     package (just list of package names)
  //
  // This variable is initialized by `loadAssets.init()`.
  var assets;


  // Track loaded URLs (as keys, values are just `true`)
  var loaded = {};


  // Sandbox object passed as an argument to each module.
  // It should be filled via `NodecaLoader.execute`.
  var N = { loader: NodecaLoader };

  // For easy debugging only.
  NodecaLoader.N = N;

  // Returns route match data for the given method (e.g. GET) on the given URL
  // or null if none is found. Requires N to be initialized.
  function findRoute(url, method) {
    var matchArray = N.router.matchAll(url),
        match,
        index,
        length;

    for (index = 0, length = matchArray.length; index < length; index += 1) {
      match = matchArray[index];

      if (has(match.meta.methods, method)) {
        return match;
      }
    }

    // Not found.
    return null;
  }


  // Storage of registered Node modules.
  // Keys are absolute file paths like '/absolute/path/to/module.js'
  var nodeModules = {};

  // Storage of module aliases. Needed for vendor modules short names.
  // Keys are short name, values are real paths.
  var nodeModulesAliases = {};

  function registerNodeModule(path, func, deps) {
    // Don't overwrite
    nodeModules[path] = nodeModules[path] || {
      initialized: false,
      func: func,
      internal: { exports: {} },
      dependencies: deps
    };
  }

  function registerNodeModuleAlias(alias, path) {
    if (!/^[a-z0-9._-]+$/g.test(alias)) {
      throw new Error('Only [ a..z, A..Z, 1..9, ., _, - ] chars allowed for aliases');
    }
    // Don't overwrite
    nodeModulesAliases[alias] = nodeModulesAliases[alias] || path;
  }

  function requireNodeModule(path) {

    if (nodeModulesAliases[path]) {
      path = nodeModulesAliases[path];
    }

    var module = nodeModules[path];

    if (!module) {
      throw new Error('Unknown module "' + path + '"');
    }

    // If it's a first require of the given module, initialize it first.
    if (!module.initialized) {
      module.func.call(
        window, // this object
        requireNodeModule,
        module.internal,
        module.internal.exports,
        module.dependencies,
        nodeModules
      );
      module.initialized = true;
    }

    return module.internal.exports;
  }

  // Really needed export.
  NodecaLoader.registerNodeModule      = registerNodeModule;
  NodecaLoader.registerNodeModuleAlias = registerNodeModuleAlias;

  // Storage of registered client modules.
  // Keys are API paths like 'app.method.submethod'
  var clientModules = {};

  function registerClientModule(apiPath, func) {
    if (has(clientModules, apiPath) && clientModules[apiPath].initialized) { return; }

    var module = clientModules[apiPath] = {
      initialized: true,
      func: func,
      internal: { exports: {}, apiPath: apiPath }
    };

    /*eslint-disable no-use-before-define*/
    initSingleClientModule(module);
  }

  // Initialize client module. Used once per module.
  function initSingleClientModule(module) {
    function resolveI18nPath(path) {
      if (path.charAt(0) === '@') {
        return path.slice(1);
      }
      return module.internal.apiPath + '.' + path;
    }

    // Local `t` (translate) function for use only within this module.
    // It allows to use phrase strings relative to the module's API path.
    function translationHelper(phrase, params) {
      return N.runtime.t(resolveI18nPath(phrase), params);
    }

    translationHelper.exists = function translationExistsHelper(phrase) {
      return N.runtime.t.exists(resolveI18nPath(phrase));
    };

    // Execute the module's `func` function. It will populate the exports.
    module.func.call(
      window, // this object
      N,
      requireNodeModule,
      module.internal.exports,
      module.internal,
      translationHelper
    );
  }

  // Initializes all loaded client modules. Once per module.
  /*function initClientModules() {
    var apiPath, module;

    for (apiPath in clientModules) {
      if (!has(clientModules, apiPath)) {
        continue;
      }

      module = clientModules[apiPath];

      if (module.initialized) {
        continue;
      }

      initSingleClientModule(module);
      module.initialized = true;
    }
  }*/

  // Really needed export.
  NodecaLoader.registerClientModule = registerClientModule;

  //
  // Configure `bag.js` loader
  //
  var bag = new window.Bag({
    timeout: 20000,
    stores: [ 'indexeddb', 'websql' ]
  });

  // Load a package with all of its associated assets and dependencies.
  // `preload` parameter is an optional array of URLs which are needed to load
  // before the given package.
  function loadAssets(pkgName, preload, callback) {
    var resources = [];
    var scheduled = {};

    if (isFunction(preload)) {
      callback = preload;
      preload  = null;
    }

    if (!assets[pkgName]) {
      callback(new Error('We dont know such package (' + pkgName + ')'));
      return;
    }

    forEach(assets[pkgName].packagesQueue.slice(0).reverse(), function (dependency) {
      var alreadyLoaded, pkgDist = assets[dependency];

      if (pkgDist.css.length) {
        alreadyLoaded = reduce(pkgDist.css, function (acc, css) {
          return acc || loaded[css] || scheduled[css];
        }, false);

        if (!alreadyLoaded) {
          resources.unshift(pkgDist.css[0]);
          scheduled[pkgDist.css[0]] = true;
        }
      }

      if (pkgDist.js.length) {
        alreadyLoaded = reduce(pkgDist.js, function (acc, js) {
          return acc || loaded[js] || scheduled[js];
        }, false);

        if (!alreadyLoaded) {
          resources.unshift(pkgDist.js[0]);
          scheduled[pkgDist.js[0]] = true;
        }
      }
    });

    // Copy the preload array to allow pushing without side-effects.
    if (preload) {
      resources = preload.concat(resources);
    }

    if (resources.length > 0) {

      var res_list = [];
      forEach(resources, function (url) {
        res_list.push({
          url: url,
          // storage key = file path without hash
          key: url.replace(/-[0-9a-f]{32}([.][a-z]+)$/, '$1')
        });
      });

      bag.require(res_list, function (err/*, data*/) {
        if (err) {
          alert('Asset load error (bag.js): ' + err);
          return;
        }

        forEach(resources, function (url) {
          loaded[url] = true;
        });

        // initClientModules();

        if (!N.wire) {
          alert('Asset load error: "N.Wire" unavailable after asset load.');
          return;
        }

        N.wire.emit('init:assets', {}, function (err) {
          if (err) {
            alert('Asset load error: "init:assets" failed. ' + err);
            return;
          }

          callback();
        });
      });
    } else {
      callback();
    }
  }


  // Loads all necessary shims and libraries and assets for given package.
  loadAssets.init = function init(assetsMap, pkgName) {
    var shims = [];

    // Set internal assets map.
    assets = assetsMap;

    // Init can be called only once.
    loadAssets.init = noop;

    // Mark all stylesheets of the given package as loaded, since they are
    // included to head of the page.
    forEach(assets[pkgName].packagesQueue, function (dependency) {
      forEach(assets[dependency].css, function (file) {
        loaded[file] = true;
      });
    });

    loadAssets(pkgName, shims, function () {
      if (!N.wire) {
        alert('Assets init error. Refresh page & try again. ' +
              'If problem still exists - contact administrator.');
        return;
      }

      // First try to match full URL, if not matched - try without anchor.
      var baseUrl = location.protocol + '//' + location.host + location.pathname,
          route   = findRoute(baseUrl + location.hash, 'get') ||
                    findRoute(baseUrl, 'get');

      if (!route) {
        alert('Init error: failed to detect internal identifier (route) of ' +
              'this page. Refresh page & try again. If problem still exists ' +
              '- contact administrator.');
        return;
      }

      // Execute after DOM is loaded:
      $(function () {
        N.wire.emit(
          [ 'navigate.done', 'navigate.done:' + route.meta.methods.get ],
          {
            url:     location.href,
            anchor:  location.hash,
            apiPath: route.meta.methods.get,
            params:  route.params
          },
          function () {
            NodecaLoader.booted = true;
          }
        );
      });
    });
  };

  // Really needed export.
  NodecaLoader.loadAssets = loadAssets;


  // Instantly executes the given `func` function passing `N` and `require`
  // as arguments.
  function execute(func) {
    func.call({}, N, requireNodeModule);
  }

  // Really needed export.
  NodecaLoader.execute = execute;

})(this);
