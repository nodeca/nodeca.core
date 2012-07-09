/**
 *  lib.filters.base_assets(params, callback) -> Void
 *
 *  Middleware that populates `env.response.head.assets` with generic assets
 *  needed for the given method (based on locale, theme and namespace), such as:
 *  translations, views, etc.
 **/


"use strict";


/*global nodeca*/


// stdlib
var path = require('path');


// nodeca
var NLib = require('nlib');


////////////////////////////////////////////////////////////////////////////////


function append_assets(env, names) {
  _.each(names, function (pathname) {
    var link = env.helpers.asset_path(pathname);

    if ('#' !== link) {
      env.response.data.head.assets.push({
        type: path.extname(link).substring(1),
        link: link
      });
    }
  });
}


////////////////////////////////////////////////////////////////////////////////


nodeca.filters.before('', {weight: 50}, function base_assets(params, callback) {
  var ns = this.request.namespace;

  if (this.origin.http) {
    append_assets(this, ['lib.js', 'app.js']);

    if ('admin' !== ns) {
      // include main app.css only for non-admin namespace
      append_assets(this, ['app.css']);
    }
  }

  //// common-wide
  //parts.push('views/' + locale + '/' + theme + '/layouts.js');
  //parts.push('views/' + locale + '/' + theme + '/common.js');
  //parts.push('common/i18n/' + locale + '.js');
  //parts.push('common/app.(?:js|css)');
  //parts.push('app.(?:js|css)');

  //// namespace-specific
  //parts.push('views/' + locale + '/' + theme + '/' + namespace + '.js');
  //parts.push(namespace + '/i18n/' + locale + '.js');
  //parts.push(namespace + 'app.(?:js|css)');

  append_assets(this, [ns + '/app.css', ns + '/app.js']);
  callback();
});
