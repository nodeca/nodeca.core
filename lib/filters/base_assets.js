"use strict";


/*global nodeca, _*/


// stdlib
var path = require('path');


// nodeca
var NLib = require('nlib');


////////////////////////////////////////////////////////////////////////////////


// dummy helper that fills env.response.data.head.assets with only those assets
// from the list of `names` which are actually exist
function inject_asset(pathname) {
  var link;

  /*jshint validthis:true,boss:true*/

  link = this.helpers.asset_path(pathname);

  if ('#' !== link) {
    this.response.data.head.assets.push({
      type: path.extname(link).substring(1),
      link: link
    });
  }
}


////////////////////////////////////////////////////////////////////////////////


// Middleware that populates `env.response.head.assets` with generic assets
// needed for the given method (based on locale, theme and namespace), such as:
// translations, views, etc.
//
nodeca.filters.before('', {weight: 50}, function base_assets(params, callback) {
  var namespace = this.request.namespace,
      locale    = this.session.locale,
      theme     = this.session.theme,
      assets    = [];

  this.extras.puncher.start('Assets check');

  if (this.origin.http) {
    assets.push(
      'lib.js', 'app.js', 'app.css',
      'views/' + locale + '/' + theme + '/layouts.js',
      'views/' + locale + '/' + theme + '/common.js',
      'views/' + locale + '/' + theme + '/widgets.js',
      'common/i18n/' + locale + '.js',
      'common/app.css',
      'common/api.js',
      'common/app.js'
    );
  }

  ['forum', 'blogs', 'users', 'admin'].forEach(function (namespace) {
    assets.push(
      'views/' + locale + '/' + theme + '/' + namespace + '.js',
      namespace + '/i18n/' + locale + '.js',
      namespace + '/app.css',
      namespace + '/api.js',
      namespace + '/app.js'
    );
  });

  // inject assets
  assets.forEach(inject_asset, this);

  this.extras.puncher.stop();

  callback();
});
