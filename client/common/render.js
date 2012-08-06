'use strict';


/**
 *  client
 **/

/**
 *  client.common
 **/


/*global window, $, _, jade, JASON, nodeca*/


////////////////////////////////////////////////////////////////////////////////


var tzOffset       = (new Date).getTimezoneOffset();
var helpers        = {};
var $puncher_stats = null;


////////////////////////////////////////////////////////////////////////////////


function render_view(apiPath, layout, locals) {
  locals = _.extend(locals, helpers);
  return nodeca.shared.common.render(nodeca.views, apiPath, layout, locals);
}


////////////////////////////////////////////////////////////////////////////////


helpers.t = nodeca.runtime.t;


helpers.date = function (value, format) {
  return nodeca.shared.common.date(value, format, nodeca.runtime.locale, tzOffset);
};

helpers.asset_path = function (pathname) {
  /*global alert*/
  alert('asset_path() is not implemented yet');
  return "";
};

helpers.asset_include = function () {
  /*global alert*/
  alert('asset_include() is a server-side only helper');
  return "";
};

helpers.link_to = function (name, params) {
  return nodeca.runtime.router.linkTo(name, params) || '#';
};

helpers.nodeca = function (path) {
  return !path ? nodeca : nodeca.shared.common.getByPath(nodeca, path);
};

// substitute JASON with JSON
helpers.jason = JSON.stringify;


////////////////////////////////////////////////////////////////////////////////


/**
 *  client.common.render(apiPath, layout, data) -> Void
 *  - apiPath (String): Server method API path.
 *  - layout (String): Layout or layouts stack
 *  - data (Object): Locals data for the renderer
 *
 *  Renders view.
 **/
module.exports = function render(apiPath, layout, data) {
  var locals;

  if (!nodeca.shared.common.getByPath(nodeca.views, apiPath)) {
    throw new Error("View " + apiPath + " not found");
  }

  return render_view(apiPath, layout, data);
};


/**
 *  client.common.render.injectPuncherStats(data) -> Void
 *  - data (Object): Locals data for the renderer
 *
 *  Renders and injects Puncher stats data if needed.
 **/
module.exports.injectPuncherStats = function injectPuncherStats(data) {
  var html;

  // try to find puncher stats first time
  if (null === $puncher_stats) {
    $puncher_stats = $('#debug_timeline');
  }

  if (!$puncher_stats.length) {
    // server didn't injected puncher stats so we don't
    return;
  }

  html = render_view('widgets.debug_timeline', false, data);

  // replace HTML with new stats
  $puncher_stats.replaceWith(html);

  // recache jQuery element
  $puncher_stats = $('#debug_timeline');
};
