'use strict';

N.wire.once('init:mdedit', function () {
  N.MDEdit.commands.cmdHelp = function () {
    let $helpDialog = $(N.runtime.render('mdedit.help_dlg'));

    $('body').append($helpDialog);
    $helpDialog.modal('show');

    $helpDialog.on('hidden.bs.modal', function () {
      $helpDialog.remove();
    });
  };
});
