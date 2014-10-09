'use strict';

var _ = require('lodash');

N.wire.once('init:mdedit', function () {
  N.MDEdit.prototype.commands.cmdImage = function (editor) {
    var range = editor.getSelectionRange();
    var document = editor.getSession().getDocument();
    var $linkDialog = $(N.runtime.render('mdedit.add_image_dlg'));
    var tpl = '![<%= alt %>](<%= url %>)';

    $('body').append($linkDialog);
    $linkDialog.modal('show');

    $linkDialog.on('hidden.bs.modal', function () {
      $linkDialog.remove();
    });

    $linkDialog.find('.add-image-dialog__apply').click(function () {
      var url = $linkDialog.find('.add-image-dialog__input').val();

      $linkDialog.modal('hide');

      if (range.end.column === range.start.column && range.end.row === range.start.row) {
        document.insert(range.end, _.template(tpl, {
          alt: t('@mdedit.add_image_dlg.alt'),
          url: url
        }));
      } else {
        document.replace(range, _.template(tpl, {
          alt: editor.getSession().getTextRange(range),
          url: url
        }));
      }
    });
  };
});
