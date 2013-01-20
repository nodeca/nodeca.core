"use strict";


/*global N, underscore*/


// 3rd-party
var _ = underscore;


////////////////////////////////////////////////////////////////////////////////


// Middleware that populates `env.response.head.assets` with generic assets
// needed for the given method (based on locale, theme and namespace), such as:
// translations, views, etc.
//
N.server.after('**', { priority: 50 }, function inject_assets_info(env, callback) {
  var key = env.runtime.locale, map;

  if (!env.origin.http) {
    // we inject assets infor for HTTP only
    callback(null);
    return;
  }

  if (env.runtime.theme) {
    key += '.' + env.runtime.theme;
  }

  if (!N.runtime.assets.distribution[key]) {
    // should never happen
    callback(new Error("Can't find assets map for " + key));
    return;
  }

  map = env.response.data.head.assets = {};

  _.each(N.runtime.assets.distribution[key], function (assets, pkgName) {
    map[pkgName] = {
      css:  N.runtime.router.linkTo('assets', {
        path: N.runtime.assets.manifest.assets[assets.stylesheet]
      }),
      js:   N.runtime.router.linkTo('assets', {
        path: N.runtime.assets.manifest.assets[assets.javascript]
      })
    };
  });

  callback();
});
