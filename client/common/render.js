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


function inject_puncher_stats(data) {
  var html;

  // try to find puncher stats first time
  if (null === $puncher_stats) {
    $puncher_stats = $('#puncher_stats');
  }

  if (!$puncher_stats.length) {
    // server didn't injected puncher stats so we don't
    return;
  }

  html = nodeca.shared.common.render(nodeca.views, 'widgets.puncher_stats', false, data);
  $puncher_stats.replaceWith(html);

  // replace cached element with new one
  $puncher_stats = $('#puncher_stats');
}


////////////////////////////////////////////////////////////////////////////////


helpers.t = function (phrase, params) {
  try {
    // TODO: should be removed once BabelFish is fixed
    return nodeca.runtime.i18n.t(nodeca.runtime.locale, phrase, params);
  } catch (err) {
    nodeca.logger.error('Failed translate phrase', phrase, params, err);
    return phrase;
  }
};

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

helpers.nodeca = nodeca;

helpers.jason = JASON.stringify;


////////////////////////////////////////////////////////////////////////////////


/**
 *  client.common.render(apiPath, layout, data) -> Void
 *  - apiPath (String): Server method API path.
 *  - layout (String): Layout or layouts stack
 *  - data (Oject): Locals data for the renderer
 *
 *  Renders view and injects result HTML into `#content` element.
 **/
module.exports = function render(apiPath, layout, data) {
  var locals, html;

  if (!nodeca.shared.common.getByPath(nodeca.views, apiPath)) {
    throw new Error("View " + apiPath + " not found");
  }

  // prepare variables
  locals = _.extend(data, helpers);
  html   = nodeca.shared.common.render(nodeca.views, apiPath, layout, locals, true);

  $('#content').html(html);

  // try to inject puncher stats
  inject_puncher_stats(locals);
};
