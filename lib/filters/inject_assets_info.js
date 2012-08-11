"use strict";


/*global nodeca, _*/


// stdlib
var path = require('path');


// nodeca
var NLib = require('nlib');


////////////////////////////////////////////////////////////////////////////////


var assets_info_cache = {};


////////////////////////////////////////////////////////////////////////////////


// returns list of asset (URLs) that are actually exists only
//
function get_filtered_assets(arr) {
  var result = [];

  _.each(arr, function (logicalPath) {
     var asset = nodeca.runtime.assets.manifest.assets[logicalPath];
     if (asset) {
       result.push("/assets/" + asset);
     }
  });

  return result;
}


function get_cache_key(env) {
  return env.session.locale + ':' + env.session.theme;
}


function get_from_cache(env) {
  var assets = assets_info_cache[get_cache_key(env)];
  return assets ? _.map(assets, function (o) { return _.clone(o); }) : false;
}


function put_into_cache(env, assets) {
  assets_info_cache[get_cache_key(env)] = _.map(assets, function (o) {
    return _.clone(o);
  });
}


////////////////////////////////////////////////////////////////////////////////


// Middleware that populates `env.response.head.assets` with generic assets
// needed for the given method (based on locale, theme and namespace), such as:
// translations, views, etc.
//
nodeca.filters.before('', { weight: 50 }, function inject_assets_info(params, callback) {
  var locale    = this.session.locale,
      theme     = this.session.theme,
      assets    = get_from_cache(this);

  if (!this.origin.http) {
    // we inject assets infor for HTTP only
    callback(null);
    return;
  }

  this.extras.puncher.start('Assets check');

  if (!!assets) {
    this.response.data.head.assets = assets;
  } else {
    assets = [];

    assets.push({
      test: function () { /*global window*/ return !!window.JSON; },
      nope: get_filtered_assets(['json2.js'])
    });

    assets.push({
      load: get_filtered_assets([
        'lib.js', 'app.js', 'app.css',
        'views/' + locale + '/' + theme + '/layouts.js',
        'views/' + locale + '/' + theme + '/widgets.js'
      ])
    });

    // FIXME: should be determined on the base of loaded apps
    ['common', 'forum', 'blogs', 'users', 'admin'].forEach(function (namespace) {
      assets.push({
        namespace: namespace,
        load: get_filtered_assets([
          'views/' + locale + '/' + theme + '/' + namespace + '.js',
          namespace + '/i18n/' + locale + '.js',
          namespace + '/app.css',
          namespace + '/api.js',
          namespace + '/app.js'
        ])
      });
    });

    put_into_cache(this, assets);
    this.response.data.head.assets = assets;
  }

  this.extras.puncher.stop();

  callback();
});
