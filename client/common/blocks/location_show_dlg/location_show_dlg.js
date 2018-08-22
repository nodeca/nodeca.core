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
  let latitude  = data.$this.data('latitude');
  let longitude = data.$this.data('longitude');
  let params    = { latitude, longitude };

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

    map = leaflet.map($('.location-show-dlg__map')[0]);

    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      map.setView([ latitude, longitude ], 14);

      // copied from leaflet.Icon.Default.prototype.options with icon urls replaced
      let icon = leaflet.icon({
        iconUrl:       '$$ JSON.stringify(asset_url("nodeca.core/client/vendor/leaflet/images/marker-icon.png")) $$',
        iconRetinaUrl: '$$ JSON.stringify(asset_url("nodeca.core/client/vendor/leaflet/images/marker-icon-2x.png")) $$',
        shadowUrl:     '$$ JSON.stringify(asset_url("nodeca.core/client/vendor/leaflet/images/marker-shadow.png")) $$',
        iconSize:      [ 25, 41 ],
        iconAnchor:    [ 12, 41 ],
        popupAnchor:   [ 1, -34 ],
        tooltipAnchor: [ 16, -28 ],
        shadowSize:    [ 41, 41 ]
      });

      leaflet.marker([], { icon })
             .setLatLng({ lat: latitude, lng: longitude })
             .addTo(map);
    } else {
      // no coordinates, show the entire map
      map.setView([ 20, 0 ], 1);
    }
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

        leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
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
