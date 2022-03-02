'use strict';

const _ = require('lodash');

N.wire.once('init:mdedit', function () {
  N.MDEdit.commands.cmdImage = function (editor) {
    let $linkDialog = $(N.runtime.render('mdedit.add_image_dlg'));
    let tpl = _.template('![<%= alt %>](<%= url %>)');

    $('body').append($linkDialog);
    $linkDialog.modal('show');

    $linkDialog.on('hidden.bs.modal', function () {
      $linkDialog.remove();
    });

    $linkDialog.on('shown.bs.modal', function () {
      $linkDialog.find('.add-image-dialog__input').focus();
    });

    $linkDialog.find('.add-image-dialog__apply').click(function () {
      let url = $linkDialog.find('.add-image-dialog__input').val();

      $linkDialog.modal('hide');

      // Do nothing on empty input
      if (!url) return;

      editor.setRangeText(tpl({ alt: '', url }), editor.selectionStart, editor.selectionEnd);
      editor.dispatchEvent(new Event('change'));
      editor.focus();
    });
  };
});
