// Popup dialog to reload if client version outdated (`io.version_mismatch`).
//
'use strict';


let shown = false;


N.wire.on('io.version_mismatch', function show_reload_dlg(hash) {
  // If our version is fresh - do nothings
  if (N.runtime.assets_hash === hash) return;

  // Check dialog already shown. Needed because could be called from two places:
  //
  // - RPC
  // - live token update
  // - live broadcasts from another tabs
  //
  if (shown) return;
  shown = true;

  // Broadcast error to other tabs
  // Note, we should wait async end, but dialog animation will
  // pause enougth for us. Keep code simple.
  if (N.live) N.live.emit('local.io.version_mismatch', hash);


  let $dialog = $(N.runtime.render(module.apiPath));

  $('body').append($dialog);

  $dialog
    .on('shown.bs.modal', () => {
      $dialog.find('.btn-secondary').focus();
    })
    .on('hidden.bs.modal', () => {
      // Reload page when dialog closes
      window.location.reload();
    })
    .modal('show');

  // Automatically reload after 5 sec
  setTimeout(function () {
    window.location.reload();
  }, 5000);
});


N.wire.once('navigate.done', function version_check_init() {
  // Install cross-tab reload listener
  if (!N.live) return;

  N.live.on('local.io.version_mismatch', function version_check(hash) {
    N.wire.emit('io.version_mismatch', hash);
  });
});
