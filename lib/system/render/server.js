// server-side renderer. Contains local helpers etc and calls common render
// method internally.


'use strict';


/*global N*/


// 3rd-party
var _ = require('lodash');


// internal
var render  = require('./common');
var date    = require('../date');


////////////////////////////////////////////////////////////////////////////////


var tzOffset = (new Date).getTimezoneOffset();
var helpers  = {};


////////////////////////////////////////////////////////////////////////////////


helpers.t = N.runtime.t;


helpers.date = function (value, format) {
  return date(value, format, N.runtime.locale, tzOffset);
};


helpers.asset_include = function asset_include(path) {
  var asset = N.runtime.assets.environment.findAsset(path);

  try {
    return !asset ? "" : asset.toString();
  } catch (err) {
    N.logger.error("Failed inline asset %s:\n%s", path,
                   (err.stack || err.message || err));
    return "";
  }
};


helpers.link_to = function (name, params) {
  return N.runtime.router.linkTo(name, params) || '#';
};


helpers.N = N;


////////////////////////////////////////////////////////////////////////////////


/**
 *  server.render(apiPath[, locals[, layout]]) -> Void
 *  - apiPath (String): Server method API path.
 *  - locals (Object): Locals data for the renderer
 *  - layout (String): Layout or layouts stack
 *
 *  Renders view.
 **/
module.exports = function (apiPath, locals, layout, env) {
  var views = N.views;

  if (!views[apiPath]) {
    throw new Error("View " + apiPath + " not found");
  }

  locals = _.extend(locals || {}, helpers, env.helpers, {runtime: env.runtime});
  return render(views, apiPath, locals, layout);
};
