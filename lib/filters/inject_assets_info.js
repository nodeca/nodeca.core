"use strict";


/*global nodeca, _*/


// stdlib
var path = require('path');


////////////////////////////////////////////////////////////////////////////////


// Middleware that populates `env.response.head.assets` with generic assets
// needed for the given method (based on locale, theme and namespace), such as:
// translations, views, etc.
//
nodeca.filters.after('', { weight: 50 }, function inject_assets_info(params, callback) {
  var key, map;

  if (!this.origin.http) {
    // we inject assets infor for HTTP only
    callback(null);
    return;
  }

  key = this.runtime.locale + '.' + this.runtime.theme;
  map = nodeca.runtime.assets.map[key];

  if (!map) {
    // should never happen
    callback(new Error("Can't find assets map for " + key));
    return;
  }

  this.extras.puncher.start('Assets check');

  // FIXME: clone object?
  this.response.data.head.assets = map;

  this.extras.puncher.stop();

  callback();
});
