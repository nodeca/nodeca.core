'use strict';


/**
 *  client
 **/

/**
 *  client.common
 **/

/**
 *  client.common.stats
 **/


/*global window, $, _, jade, JASON, nodeca*/


////////////////////////////////////////////////////////////////////////////////


var $puncher_stats = null;


////////////////////////////////////////////////////////////////////////////////


/**
 *  client.common.stats.injectPuncher(data) -> Void
 *  - data (Object): Locals data for the renderer
 *
 *  Renders and injects Puncher stats data if needed.
 **/
module.exports.injectPuncher = function injectPuncher(data) {
  var html;

  // try to find puncher stats first time
  if (null === $puncher_stats) {
    $puncher_stats = $('#debug_timeline');
  }

  if (!$puncher_stats.length) {
    // server didn't injected puncher stats so we don't
    return;
  }

  html = nodeca.client.common.render('widgets.debug_timeline', false, data);

  // replace HTML with new stats
  $puncher_stats.replaceWith(html);

  // recache jQuery element
  $puncher_stats = $('#debug_timeline');
};
