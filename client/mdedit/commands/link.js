'use strict';

var _ = require('lodash');

N.wire.once('init:mdedit', function () {
  N.MDEdit.commands.cmdLink = function (editor) {
    var $linkDialog = $(N.runtime.render('mdedit.add_link_dlg'));
    var tpl = _.template('[<%= desc %>](<%= url %>)');

    $('body').append($linkDialog);

    if (editor.somethingSelected()) {
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
      if (!url || (!editor.somethingSelected() && !text)) { return; }

      if (editor.somethingSelected()) {
        editor.replaceSelection(tpl({ desc: editor.getSelection(), url: url }));
      } else {
        editor.replaceRange(tpl({ desc: text, url: url }), editor.getCursor(), editor.getCursor());
      }

      editor.focus();
    });
  };
});
