'use strict';

const _ = require('lodash');

N.wire.once('init:mdedit', function () {
  N.MDEdit.commands.cmdLink = function (editor) {
    let $linkDialog = $(N.runtime.render('mdedit.add_link_dlg'));
    let tpl = _.template('[<%= desc %>](<%= url %>)');

    $('body').append($linkDialog);

    let somethingSelected = (editor.selectionStart !== editor.selectionEnd);

    if (somethingSelected) {
      $linkDialog.addClass('add-link-dialog__m-no-text');
    }

    $linkDialog.modal('show');

    $linkDialog.on('hidden.bs.modal', function () {
      $linkDialog.remove();
    });

    $linkDialog.on('shown.bs.modal', function () {
      if (somethingSelected) {
        $linkDialog.find('.add-link-dialog__link').focus();
      } else {
        $linkDialog.find('.add-link-dialog__text').focus();
      }
    });

    $linkDialog.find('.add-link-dialog__apply').click(function () {
      let url = $linkDialog.find('.add-link-dialog__link').val();
      let text = $linkDialog.find('.add-link-dialog__text').val();

      $linkDialog.modal('hide');

      // Do nothing on empty input
      if (!url || (!somethingSelected && !text)) return;

      let replacement;
      if (somethingSelected) {
        replacement = tpl({ desc: editor.value.slice(editor.selectionStart, editor.selectionEnd), url });
      } else {
        replacement = tpl({ desc: text, url });
      }

      editor.setRangeText(replacement, editor.selectionStart, editor.selectionEnd);
      editor.dispatchEvent(new Event('change'));
      editor.focus();
    });
  };
});
