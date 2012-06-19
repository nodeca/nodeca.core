/**
 *  nodeca.loader
 *
 *  This module provides namespace assets loading for nodeca/nlib based
 *  applcations.
 **/


//= depend_on nodeca
//= require modernizr


/*global window, $, _, Modernizr, yepnope, nodeca*/


(function () {
  'use strict';


  // list of already loaded assets
  // TODO: cache loaded assets in the LocalStorage
  var loaded = [];


  // Builds RegExp used to find assets for given namespace
  function build_namespace_regexp(namespace) {
    var locale  = nodeca.runtime.locale,
        theme   = nodeca.runtime.theme,
        parts   = [];

    // common-wide
    parts.push('views/' + locale + '/' + theme + '/layouts.js');
    parts.push('views/' + locale + '/' + theme + '/common.js');
    parts.push('common/i18n/' + locale + '.js');
    parts.push('common/app.(?:js|css)');
    parts.push('app.(?:js|css)');

    // namespace-specific
    parts.push('views/' + locale + '/' + theme + '/' + namespace + '.js');
    parts.push(namespace + '/i18n/' + locale + '.js');
    parts.push(namespace + 'app.(?:js|css)');

    return new RegExp('^(?:' + parts.join('|') + ')$');
  }


  // Returns list of assets that should be loaded by yepnope
  function find_assets(namespace) {
    var assets = [],
        regexp = build_namespace_regexp(namespace);

    _.each(nodeca.config.assets, function (digestPath, logicalPath) {
      if (-1 < loaded.indexOf(digestPath) && regexp.test(logicalPath)) {
        assets.push(nodeca.runtime.ASSETS_BASEURL + digestPath);
      }
    });

    return assets;
  }

  // loader that requries assets for given namespace
  nodeca.load = function load(namespace, callback) {
    var assets = find_assets(namespace);

    // TODO: load assets from localStorage if some were found.
    //       LocalStorage should be something like:
    //       { <logicalPath>: [<digestPath>, <timestamp>, <data>] }

    yepnope({load: assets, complete: function () {
      loaded = loaded.concat(assets);
      callback();
    }});
  };
}());
