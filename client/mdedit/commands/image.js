'use strict';

var _ = require('lodash');

N.wire.once('init:mdedit', function () {
  N.MDEdit.commands.cmdImage = function (editor) {
    var $linkDialog = $(N.runtime.render('mdedit.add_image_dlg'));
    var tpl = _.template('![<%= alt %>](<%= url %>)');

    $('body').append($linkDialog);
    $linkDialog.modal('show');

    $linkDialog.on('hidden.bs.modal', function () {
      $linkDialog.remove();
    });

    $linkDialog.find('.add-image-dialog__apply').click(function () {
      var url = $linkDialog.find('.add-image-dialog__input').val();

      $linkDialog.modal('hide');

      // Do nothing on empty input
      if (!url) { return; }

      if (editor.somethingSelected()) {
        editor.replaceSelection(tpl({ alt: '', url: url }));
      } else {
        editor.replaceRange(tpl({ alt: '', url: url }), editor.getCursor(), editor.getCursor());
      }

      editor.focus();
    });
  };
});
