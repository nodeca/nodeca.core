// Popup dialog to show a location on the map
//
'use strict';


let $dialog;
let map;


// Show dialog
//
N.wire.before(module.apiPath, function location_show_dlg(data) {
  let params = {
    latitude:  data.$this.data('latitude'),
    longitude: data.$this.data('longitude')
  };

  $dialog = $(N.runtime.render(module.apiPath, params));
  $('body').append($dialog);

  $dialog
    .on('hidden.bs.modal', function () {
      // When dialog closes - remove it from body and free resources.
      $dialog.remove();
      $dialog = null;

      if (map) {
        map.remove();
        map = null;
      }
    })
    .modal('show');
});


// Load dependencies
//
N.wire.before(module.apiPath, function load_deps(__, callback) {
  N.loader.loadAssets('vendor.leaflet', callback);
});


function tile_map() {
  const leaflet = require('leaflet').noConflict();

  // map is created, then dialog is animated, then tiles are rendered,
  // so we need to reset position cache filled on map creation
  map.invalidateSize();

  leaflet.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://osm.org/copyright" target="_blank">OpenStreetMap</a> contributors'
  }).addTo(map);
}


// Render map
//
N.wire.on(module.apiPath, function render_map(/* data */) {
  const leaflet = require('leaflet').noConflict();

  // dialog had been closed before leaflet was loaded
  if (!$dialog) return;

  // rare case when user opens dialog, then closes, and opens it again quickly
  if (map) map.remove();

  map = leaflet.map($('.location-show-dlg__map')[0]).setView([ 20, 0 ], 2);

  if ($dialog.hasClass('in')) {
    tile_map();
  } else {
    // delay map rendering until dialog animation is completed
    $dialog.on('shown.bs.modal', tile_map);
  }
});


// Close dialog on sudden page exit (if user click back button in browser)
//
N.wire.on('navigate.exit', function teardown_page() {
  if ($dialog) {
    $dialog.modal('hide');
  }
});
