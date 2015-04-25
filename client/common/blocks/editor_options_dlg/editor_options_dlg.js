// Popup dialog to change posting options
//
// options (in/out):
//
// - no_mlinks (Boolean) - don't convert medialinks
// - no_smiles (Boolean) - don't convert smiles
//
'use strict';


var $dialog;
var doneCallback;
var options;


// Init dialog
//
N.wire.on(module.apiPath, function show_posting_options_dlg(data, callback) {
  doneCallback = callback;
  options = data;
  $dialog = $(N.runtime.render(module.apiPath, options));

  $('body').append($dialog);

  // When dialog closes - remove it from body
  $dialog
    .on('hidden.bs.modal', function () {
      $dialog.remove();
      $dialog = null;
      doneCallback = null;
      options = null;
    })
    .modal('show');
});


// Listen submit button
//
N.wire.on(module.apiPath + ':submit', function submit_posting_options_dlg(data) {
  options.no_mlinks = !data.fields.mlinks;
  options.no_smiles = !data.fields.smiles;

  doneCallback();

  $dialog.modal('hide');
});


// Close dialog on sudden page exit (if user click back button in browser)
//
N.wire.on('navigate.exit', function teardown_page() {
  if ($dialog) {
    $dialog.modal('hide');
  }
});
