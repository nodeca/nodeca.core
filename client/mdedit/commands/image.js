'use strict';


const _                 = require('lodash');
const text_field_update = require('../_lib/text_field_update');


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

      text_field_update.insert(editor, tpl({ alt: '', url }));
    });
  };
});
