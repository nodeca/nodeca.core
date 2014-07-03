// Show confirm dialog
//
// Example:
//
// N.wire.emit('confirm', 'Are you sure?', function () {
//  // Pressed 'OK'
// });
//

'use strict';

var okCallback;
var $dialog;


N.wire.on('admin.core.blocks.confirm', function confirm(data, callback) {
  if (typeof data === 'string') {
    data = { message: data };
  }

  okCallback = callback;
  $dialog = $(N.runtime.render('admin.core.blocks.confirm', data));
  $('body').append($dialog);

  $dialog.on('shown.bs.modal', function () {
    $dialog.find('.btn-default').focus();
  }).on('hidden.bs.modal', function () {
    okCallback = null;
    $dialog.remove();
    $dialog = null;
  }).modal('show');
});


// Pressed 'OK'
//
N.wire.on('admin.core.blocks.confirm:ok', function confirm_ok() {
  if (okCallback) {
    okCallback();
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
