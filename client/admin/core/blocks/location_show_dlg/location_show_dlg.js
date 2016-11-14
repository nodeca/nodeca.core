// Popup dialog to show a location on the map
//
'use strict';


let $dialog;
let map;


// Show dialog
//
N.wire.on(module.apiPath, function location_show_dlg(data) {
  //
  // Create dialog
  //
  let params = {
    latitude:  data.$this.data('latitude'),
    longitude: data.$this.data('longitude')
  };

  $dialog = $(N.runtime.render(module.apiPath, params));
  $('body').append($dialog);

  //
  // Load leaflet and init map afterwards
  //
  let waitForMap = N.loader.loadAssets('vendor.leaflet').then(function init_map() {
    const leaflet = require('leaflet').noConflict();

    // dialog had been closed before leaflet was loaded
    if (!$dialog) return;

    // rare case when user opens dialog, then closes, and opens it again quickly
    if (map) map.remove();

    map = leaflet.map($('.location-show-dlg__map')[0]).setView([ 20, 0 ], 2);
  });

  //
  // Start tiling map after dialog is fully shown
  //
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
    .on('shown.bs.modal', function () {
      waitForMap.then(function tile_map() {
        const leaflet = require('leaflet').noConflict();

        // map is initialized when container size is 0,
        // so we need to reset internal size cache to actual size
        map.invalidateSize();

        leaflet.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="http://osm.org/copyright" target="_blank">OpenStreetMap</a> contributors'
        }).addTo(map);
      });
    })
    .modal('show');
});


// Close dialog on sudden page exit (if user click back button in browser)
//
N.wire.on('navigate.exit', function teardown_page() {
  if ($dialog) {
    $dialog.modal('hide');
  }
});
