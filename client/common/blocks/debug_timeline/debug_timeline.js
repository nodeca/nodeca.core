/**
 *  Renders and injects debug stats on successful RPC requests.
 **/


'use strict';


let shown_stats_id = null;


function fetch_puncher_stats() {
  let $timeline = $('#debug_timeline');

  // Skip if there is no #debug_timeline
  if ($timeline.length === 0) return;

  let puncher_ref = document.cookie.replace(/(?:(?:^|.*;\s*)stats-id\s*\=\s*([^;]*).*$)|^.*$/, '$1');

  if (!puncher_ref) return;

  puncher_ref = puncher_ref.split('_');

  if (shown_stats_id === puncher_ref[0]) return;

  shown_stats_id = puncher_ref[0];

  // unset cookie
  document.cookie = 'stats-id=; path=/; max-age=0';

  N.io.rpc('common.puncher', {
    stats_id: puncher_ref[0],
    secret_key: puncher_ref[1]
  }, { persistent: true }).then(res => {
    $timeline.replaceWith(
      N.runtime.render(module.apiPath, {
        stats: res.puncher_stats
      })
    );
  }).catch(err => {
    if (err.code === N.io.NOT_FOUND) return;

    N.wire.emit('error', err);
  });
}


N.wire.on('io.complete', function debug_timeline(info) {
  // Skip if debug mode is off
  if (!$('body').hasClass('debug-on')) return;

  // Skip if puncher stats not received.
  if (!info.res) return;

  // Don't show puncher stats for requests made by this function
  if (info.res.puncher_stats) return;

  fetch_puncher_stats();
});


N.wire.after('@debug:toggle', function debug_timeline() {
  // Skip if debug mode is off
  if (!$('body').hasClass('debug-on')) return;

  fetch_puncher_stats();
});


// Toggle timeline view. By defaul it hide elements with small value
// to make output shorter
N.wire.on('common.blocks.debug_timeline:toggle_hidden', function debug_timeline_toggle_hidden(data) {
  data.$this.toggleClass('debug-timeline__m-show-hidden');
});
