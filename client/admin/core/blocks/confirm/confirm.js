// Show confirm dialog
//
// - data - String message or Object
//   - message - String message
//   - errorOnCancel - Boolean. callback with error if confirmation canceled. Default false
//
// Example:
//
// N.wire.emit('confirm', 'Are you sure?', function () {
//  // Pressed 'OK'
// });
//

'use strict';

var doneCallback;
var $dialog;


N.wire.on('common.blocks.confirm', function confirm(data, callback) {
  if (typeof data === 'string') {
    data = { message: data };
  }

  doneCallback = callback;

  $dialog = $(N.runtime.render('common.blocks.confirm', data));
  $('body').append($dialog);

  $dialog
    .on('shown.bs.modal', function () {
      $dialog.find('.btn-default').focus();
    })
    .on('hidden.bs.modal', function () {
      if (doneCallback && data.errorOnCancel) {
        doneCallback(true);
      }

      $dialog.remove();
      doneCallback = null;
      $dialog = null;
    })
    .modal('show');
});


// Pressed 'OK'
//
N.wire.on('common.blocks.confirm:ok', function confirm_ok() {
  if (doneCallback) {
    doneCallback();
    doneCallback = null;
  }

  $dialog.modal('hide');
});


// Close dialog on sudden page exit (if user click back button in browser)
//
N.wire.on('navigate.exit', function teardown_page() {
  if ($dialog) {
    $dialog.modal('hide');
  }
});
