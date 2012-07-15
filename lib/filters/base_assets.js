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
  var namespace = this.request.namespace,
      locale    = this.session.locale,
      theme     = this.session.theme;

  if (this.origin.http) {
    append_assets(this, [
      'lib.js', 'app.js', 'app.css',
      'views/' + locale + '/' + theme + '/layouts.js',
      'views/' + locale + '/' + theme + '/common.js',
      'common/i18n/' + locale + '.js',
      'common/app.css',
      'common/api.js',
      'common/app.js'
    ]);
  }

  ['forum', 'blogs', 'users', 'admin'].forEach(function (namespace) {
    append_assets(this, [
      'views/' + locale + '/' + theme + '/' + namespace + '.js',
      namespace + '/i18n/' + locale + '.js',
      namespace + '/app.css',
      namespace + '/api.js',
      namespace + '/app.js'
    ]);
  }, this);

  callback();
});
