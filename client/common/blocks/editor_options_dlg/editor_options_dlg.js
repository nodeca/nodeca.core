// Popup dialog to change posting options
//
// options (in/out):
//
// - no_mlinks         (Boolean) - don't convert medialinks
// - no_emojis         (Boolean) - don't convert emoticons
// - no_quote_collapse (Boolean) - don't collapse content inside quotes
//
'use strict';


let $dialog;
let options;
let result;


// Init dialog
//
N.wire.on(module.apiPath, function show_posting_options_dlg(data) {
  options = data;
  $dialog = $(N.runtime.render(module.apiPath, options));
  result = null;

  $('body').append($dialog);

  return new Promise((resolve, reject) => {
    $dialog
      .on('hidden.bs.modal', function () {
        // When dialog closes - remove it from body
        $dialog.remove();
        $dialog = null;
        options = null;

        if (result) resolve(result);
        else reject('CANCELED');

        result = null;
      })
      .modal('show');
  });
});


// Listen submit button
//
N.wire.on(module.apiPath + ':submit', function submit_posting_options_dlg(data) {
  options.no_mlinks         = !data.fields.mlinks;
  options.no_emojis         = !data.fields.emojis;
  options.no_quote_collapse = !data.fields.quote_collapse;

  result = options;

  $dialog.modal('hide');
});


// Close dialog on sudden page exit (if user click back button in browser)
//
N.wire.on('navigate.exit', function teardown_page() {
  if ($dialog) {
    $dialog.modal('hide');
  }
});
