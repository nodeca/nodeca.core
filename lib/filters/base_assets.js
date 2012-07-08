/**
 *  lib.filters.base_assets(params, callback) -> Void
 *
 *  Middleware that populates `env.response.head.assets` with generic assets
 *  needed for the given method (based on locale, theme and namespace), such as:
 *  translations, views, etc.
 **/


"use strict";


/*global nodeca*/


// nodeca
var NLib = require('nlib');


////////////////////////////////////////////////////////////////////////////////


nodeca.filters.before('', {weight: 50}, function base_assets(params, callback) {
  callback();
});
