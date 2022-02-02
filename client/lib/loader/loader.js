/*eslint-disable no-alert, object-shorthand*/

(function (window) {
  'use strict';

  // Needed because we can't enable only `global` in browserify. Used by Faye.
  window.global = window.global || window;

  //////////////////////////////////////////////////////////////////////////////
  // features testing & setup no-cookies/no-js styles
  //

  function testCookies() {
    if (navigator.cookieEnabled) return true; // Quick test

    document.cookie = 'cookietest=1';
    var ret = document.cookie.indexOf('cookietest=') !== -1;
    document.cookie = 'cookietest=1; expires=Thu, 01-Jan-1970 00:00:01 GMT';
    return ret;
  }

  var docElement = document.documentElement,
      className = docElement.className;

  className = className.replace('no-js', '');
  className += ' js';
  className += testCookies() ? '' : ' no-cookies';
  className = className
                .replace(/^\s+/, '')
                .replace(/\s+$/, '')
                .replace(/\s+/g, ' ');

  docElement.className = className;

  //////////////////////////////////////////////////////////////////////////////

  var NodecaLoader = window.NodecaLoader = { booted: false };
  var alert = window.alert;
  var prelude = '$$ asset_body("browser-pack/prelude.js") $$';
  var require = prelude({}, {}, []);


  NodecaLoader.wrap = function (modules, cache, entry) {
    require = prelude(modules, cache, entry);
  };


  function uniq(array) { return array.filter((x, i, a) => a.indexOf(x) === i); }

  // Cached non-operable function.
  function noop() {}

  function get_script(source) {
    return new Promise(function (resolve) {
      var script = document.createElement('script');
      script.async = false;

      script.onload = script.onreadystatechange = function (_, isAbort) {
        if (isAbort || !script.readyState || /loaded|complete/.test(script.readyState)) {
          script.onload = script.onreadystatechange = null;
          /* eslint-disable no-undefined */
          script = undefined;
          if (!isAbort) setTimeout(resolve, 0);
        }
      };

      script.src = source;
      document.getElementsByTagName('head')[0].appendChild(script);
    });
  }

  function get_style(source) {
    var link = document.createElement('link');
    link.href = source;
    link.type = 'text/css';
    link.rel = 'stylesheet';
    link.media = 'screen,print';
    document.getElementsByTagName('head')[0].appendChild(link);
  }

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

      if (match.meta.methods[method]) return match;
    }

    // Not found.
    return null;
  }

  // Storage of registered client modules.
  // Keys are API paths like 'app.method.submethod'
  var clientModules = {};

  function registerClientModule(apiPath, func) {
    if (clientModules[apiPath] && clientModules[apiPath].initialized) return;

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
      if (path.charAt(0) === '@') return path.slice(1);
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

    // Execute the module's `func` function. It will populate the exports. Require
    // function passed through `NodecaLoader.wrap()`.
    module.func.call(
      window, // this object
      N,
      module.internal.exports,
      module.internal,
      translationHelper
    );
  }

  // Really needed export.
  NodecaLoader.registerClientModule = registerClientModule;

  // Load a package with all of its associated assets and dependencies.
  // `preload` parameter is an optional array of URLs which are needed to load
  // before the given package.
  function loadAssets(pkgNames, preload) {
    var resources = [];
    var scheduled = {};
    var loadQueue = [];

    pkgNames = Array.isArray(pkgNames) ? pkgNames : [ pkgNames ];

    if (!pkgNames.length) {
      return Promise.resolve();
    }

    for (var i = 0; i < pkgNames.length; i++) {
      if (!assets[pkgNames[i]]) {
        return Promise.reject(new Error('Unknown package (' + pkgNames[i] + ')'));
      }

      loadQueue = loadQueue.concat(assets[pkgNames[i]].packagesQueue.slice(0).reverse());
    }

    uniq(loadQueue).forEach(function (dependency) {
      var alreadyLoaded, pkgDist = assets[dependency];

      if (pkgDist.css.length) {
        alreadyLoaded = pkgDist.css.reduce(function (acc, css) {
          return acc || loaded[css] || scheduled[css];
        }, false);

        if (!alreadyLoaded) {
          resources.unshift(pkgDist.css[0]);
          scheduled[pkgDist.css[0]] = true;
        }
      }

      if (pkgDist.js.length) {
        alreadyLoaded = pkgDist.js.reduce(function (acc, js) {
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

    if (!resources.length) return Promise.resolve();

    // Inject CSS
    resources.forEach(function (file) {
      if (/[.]css$/.test(file)) { get_style(file); }
    });

    // Inject JS
    var wait_js = [];
    resources.forEach(function (file) {
      if (/[.]js$/.test(file)) { wait_js.push(get_script(file)); }
    });

    return Promise.all(wait_js)
      .then(function () {
        resources.forEach(function (url) { loaded[url] = true; });

        if (!N.wire) { throw new Error('Asset load error: "N.Wire" unavailable.'); }

        // make sure DOM is loaded
        return new Promise(function (resolve) {
          if (document.readyState !== 'loading') {
            resolve();
            return;
          }

          function onload() {
            document.removeEventListener('DOMContentLoaded', onload);
            resolve();
          }

          document.addEventListener('DOMContentLoaded', onload);
        });
      })
      .then(function () {
        return N.wire.emit('init:assets', {}).catch(function (err) {
          throw new Error('Asset load error: "init:assets" failed. ' + (err.message || err));
        });
      });
  }


  // Loads all necessary shims and libraries and assets for given package.
  loadAssets.init = function init(assetsMap, pkgName, shims) {
    shims = shims || [];

    // Set internal assets map.
    assets = assetsMap;

    // Init can be called only once.
    loadAssets.init = noop;

    // Mark all stylesheets of the given package as loaded, since they are
    // included to head of the page.
    assets[pkgName].packagesQueue.forEach(function (dependency) {
      assets[dependency].css.forEach(function (file) { loaded[file] = true; });
    });

    loadAssets(pkgName, shims).then(function () {
      if (!N.wire) {
        throw new Error('Assets init error. Refresh page & try again. ' +
                        'If problem still exists - contact administrator.');
      }

      // First try to match full URL, if not matched - try without anchor.
      var baseUrl = location.protocol + '//' + location.host + location.pathname + location.search,
          route   = findRoute(baseUrl + location.hash, 'get') ||
                    findRoute(baseUrl, 'get');

      if (!route) {
        throw new Error('Init error: failed to detect internal identifier (route) of ' +
                        'this page. Refresh page & try again. If problem still exists ' +
                        '- contact administrator.');
      }

      var page_env = {
        url:        location.href,
        anchor:     location.hash,
        apiPath:    route.meta.methods.get,
        params:     route.params,
        state:      window.history.state,
        first_load: true
      };

      var preload = [];

      Promise.resolve()
      .then(function () { return N.wire.emit('navigate.preload:' + route.meta.methods.get, preload); })
      .then(function () { return loadAssets(preload); })
      .then(function () { return N.wire.emit('navigate.done', page_env); })
      .then(function () { return N.wire.emit('navigate.done:' + route.meta.methods.get, page_env); })
      .then(function () { NodecaLoader.booted = true; })
      .catch(function (err) {
        /*eslint-disable no-console*/
        try { console.error(err); } catch (__) {}
        alert('Init error: ' + err);
      });
    })
    .catch(function (err) {
      alert(err.message || err);
    });
  };

  // Helper for dynamic components load.
  NodecaLoader.loadAssets = loadAssets;

  // Called from loaded nodeca packages to init content.
  NodecaLoader.execute = function execute(fn) {
    fn.call({}, N, require);
  };

})(window);
