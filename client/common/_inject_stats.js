/**
 *  injectStats(data) -> Void
 *  - data (Object): Locals data for the renderer
 *
 *  Renders and injects debug stats data if needed.
 **/


'use strict';


var $puncher_stats = null;


module.exports = function injectStats(data) {
  var html;

  // try to find puncher stats first time
  if (!$puncher_stats) {
    $puncher_stats = $('#debug_timeline');
  }

  if (!$puncher_stats.length) {
    // server didn't injected puncher stats so we don't
    return;
  }

  html = N.runtime.render('common.blocks.debug_timeline', {
    stats: data.blocks.puncher_stats
  });

  // replace HTML with new stats
  $puncher_stats.replaceWith(html);

  // recache jQuery element
  $puncher_stats = $('#debug_timeline');
};
