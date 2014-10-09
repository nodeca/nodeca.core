'use strict';

var _ = require('lodash');

N.wire.once('init:mdedit', function () {
  N.MDEdit.prototype.commands.cmdLink = function (editor) {
    var range = editor.getSelectionRange();
    var document = editor.getSession().getDocument();
    var $linkDialog = $(N.runtime.render('mdedit.add_link_dlg'));
    var tpl = '[<%= desc %>](<%= url %>)';

    $('body').append($linkDialog);
    $linkDialog.modal('show');

    $linkDialog.on('hidden.bs.modal', function () {
      $linkDialog.remove();
    });

    $linkDialog.find('.add-link-dialog__apply').click(function () {
      var url = $linkDialog.find('.add-link-dialog__input').val();

      $linkDialog.modal('hide');

      if (range.end.column === range.start.column && range.end.row === range.start.row) {
        document.insert(range.end, _.template(tpl, {
          desc: t('@mdedit.add_link_dlg.description'),
          url: url
        }));
      } else {
        document.replace(range, _.template(tpl, {
          desc: editor.getSession().getTextRange(range),
          url: url
        }));
      }
    });
  };
});
