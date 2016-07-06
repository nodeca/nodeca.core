// Popup dialog to reload if client version outdated (`io.version_mismatch`).
//
'use strict';


let shown = false;


N.wire.on('io.version_mismatch', function show_reload_dlg() {
  // Check dialog already shown. Needed because could be called from two places:
  //
  // - RPC
  // - live
  //
  if (shown) return;
  shown = true;


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
