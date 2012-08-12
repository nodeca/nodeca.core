"use strict";


/*global nodeca, _*/


// stdlib
var path = require('path');


// nodeca
var NLib = require('nlib');


////////////////////////////////////////////////////////////////////////////////


function clone_assets_map(original) {
  if (_.isArray(original)) {
    return _.map(original, function (o) {
      return clone_assets_map(o);
    });
  }

  if (!_.isObject(original)) {
    return original;
  }

  var copy = {};

  _.each(original, function (val, key) {
    copy[key] = clone_assets_map(val);
  });

  return copy;
}


////////////////////////////////////////////////////////////////////////////////


// Middleware that populates `env.response.head.assets` with generic assets
// needed for the given method (based on locale, theme and namespace), such as:
// translations, views, etc.
//
nodeca.filters.before('', { weight: 50 }, function inject_assets_info(params, callback) {
  var key, map;

  if (!this.origin.http) {
    // we inject assets infor for HTTP only
    callback(null);
    return;
  }

  key = [this.session.locale, this.session.theme].join(':');
  map = nodeca.runtime.assets.map[key];

  if (!map) {
    // should never happen
    callback(new Error("Can't find assets map for " + key));
    return;
  }

  this.extras.puncher.start('Assets check');

  this.response.data.head.assets = clone_assets_map(map);

  this.extras.puncher.stop();

  callback();
});
