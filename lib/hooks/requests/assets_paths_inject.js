// Populates `env.response.head.assets` with generic assets
// needed for the given method (based on locale and namespace), such as:
// translations, views, etc.
//

"use strict";


var _ = require('lodash');


module.exports = function (N) {
  
  N.wire.after('server:**', { priority: 50 }, function inject_assets_info(env, callback) {

    var key = env.runtime.locale, map;

    if (!env.origin.http) {
      // we inject assets infor for HTTP only
      callback(null);
      return;
    }

    if (!N.runtime.assets.distribution[key]) {
      // should never happen
      callback(new Error("Can't find assets map for " + key));
      return;
    }

    map = env.response.data.head.assets = {};

    _.each(N.runtime.assets.distribution[key], function (assets, pkgName) {
      map[pkgName] = {
        css:  N.runtime.router.linkTo('core.assets', {
          path: N.runtime.assets.manifest.assets[assets.stylesheet]
        }),
        js:   N.runtime.router.linkTo('core.assets', {
          path: N.runtime.assets.manifest.assets[assets.javascript]
        })
      };
    });

    callback();
  });
};
