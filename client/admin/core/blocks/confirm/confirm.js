// Show confirm dialog
//
// - data - String message or Object
//   - message - String message
//
// Example:
//
//   N.wire.emit('confirm', 'Are you sure?')
//     .then(/* confirmed */)
//     .catch(/* canceled */);
//
'use strict';


let $dialog;
let confirmed;


N.wire.once(module.apiPath, function init_handlers() {

  // Pressed 'OK'
  //
  N.wire.on(module.apiPath + ':ok', function confirm_ok() {
    confirmed = true;
    $dialog.modal('hide');
  });


  // Close dialog on sudden page exit (if user click back button in browser)
  //
  N.wire.on('navigate.exit', function teardown_page() {
    if ($dialog) {
      $dialog.modal('hide');
    }
  });
});


N.wire.on(module.apiPath, function confirm(data) {
  if (typeof data === 'string') {
    data = { message: data };
  }

  confirmed = false;
  $dialog = $(N.runtime.render(module.apiPath, data));
  $('body').append($dialog);

  return new Promise((resolve, reject) => {
    $dialog
      .on('shown.bs.modal', function () {
        $dialog.find('.btn-light').focus();
      })
      .on('hidden.bs.modal', function () {
        $dialog.remove();
        $dialog = null;

        if (confirmed) resolve();
        else reject('CANCELED');
      })
      .modal('show');
  });
});
