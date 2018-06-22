// Popup dialog to report moderator
//
// - placeholder - custom placeholder for textarea
// - messages - array of messages string (first line is title)
//
'use strict';


let $dialog;
let params;
let result;


N.wire.once(module.apiPath, function init_handlers() {

  // Submit button handler
  //
  N.wire.on(module.apiPath + ':submit', function submit_abuse_report_dlg(form) {
    form.$this.addClass('was-validated');

    if (form.$this[0].checkValidity() === false) return;

    params.message = form.fields.message;
    result = params;
    $dialog.modal('hide');
  });


  // Template select handler
  //
  N.wire.on(module.apiPath + ':quick_fill', function template_select_abuse_report_dlg(data) {
    let value = data.$this.val();

    if (value) {
      // Cut first line because it is title
      $dialog.find('.abuse-report-dlg__message').val(value.split('\n').slice(1).join('\n'));
    }
  });


  // Close dialog on sudden page exit (if user click back button in browser)
  //
  N.wire.on('navigate.exit', function teardown_page() {
    if ($dialog) {
      $dialog.modal('hide');
    }
  });
});


// Init dialog
//
N.wire.on(module.apiPath, function show_abuse_report_dlg(options) {
  params = options;
  $dialog = $(N.runtime.render(module.apiPath, params));

  $('body').append($dialog);

  return new Promise((resolve, reject) => {
    $dialog
      .on('shown.bs.modal', () => {
        $dialog.find('.btn-secondary').focus();
      })
      .on('hidden.bs.modal', () => {
        // When dialog closes - remove it from body and free resources
        $dialog.remove();
        $dialog = null;
        params = null;

        if (result) resolve(result);
        else reject('CANCELED');

        result = null;
      })
      .modal('show');
  });
});
