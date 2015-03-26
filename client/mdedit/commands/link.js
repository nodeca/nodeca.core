'use strict';

var _ = require('lodash');

N.wire.once('init:mdedit', function () {
  N.MDEdit.prototype.commands.cmdLink = function (editor) {
    var range = editor.getSelectionRange();
    var textSelected = !(range.end.column === range.start.column && range.end.row === range.start.row);
    var document = editor.getSession().getDocument();
    var $linkDialog = $(N.runtime.render('mdedit.add_link_dlg'));
    var tpl = _.template('[<%= desc %>](<%= url %>)');

    $('body').append($linkDialog);

    if (textSelected) {
      $linkDialog.addClass('add-link-dialog__m-no-text');
    }

    $linkDialog.modal('show');

    $linkDialog.on('hidden.bs.modal', function () {
      $linkDialog.remove();
    });

    $linkDialog.find('.add-link-dialog__apply').click(function () {
      var url = $linkDialog.find('.add-link-dialog__link').val();
      var text = $linkDialog.find('.add-link-dialog__text').val();

      $linkDialog.modal('hide');

      // Do nothing on empty input
      if (!url || (!textSelected && !text)) { return; }

      if (textSelected) {
        document.replace(range, tpl({
          desc: editor.getSession().getTextRange(range),
          url: url
        }));
      } else {
        document.insert(range.end, tpl({
          desc: text,
          url: url
        }));
      }
    });
  };
});
