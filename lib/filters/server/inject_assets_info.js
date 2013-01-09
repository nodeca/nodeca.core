"use strict";


/*global N*/



////////////////////////////////////////////////////////////////////////////////


// Middleware that populates `env.response.head.assets` with generic assets
// needed for the given method (based on locale, theme and namespace), such as:
// translations, views, etc.
//
N.filters.after('', { weight: 50 }, function inject_assets_info(params, callback) {
  var key = this.runtime.locale;

  if (!this.origin.http) {
    // we inject assets infor for HTTP only
    callback(null);
    return;
  }

  if (this.runtime.theme) {
    key += '.' + this.runtime.theme;
  }

  this.response.data.head.assets = N.runtime.assets.distribution[key];

  if (!this.response.data.head.assets) {
    // should never happen
    callback(new Error("Can't find assets map for " + key));
    return;
  }

  callback();
});
