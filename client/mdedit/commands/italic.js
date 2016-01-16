'use strict';

N.wire.once('init:mdedit', function () {
  N.MDEdit.commands.cmdItalic = function (editor) {
    // TODO: copypaste from cmd_bold
    if (!editor.somethingSelected()) {
      return;
    }

    let selectionStart = editor.getCursor(true);
    let selectionEnd = editor.getCursor(false);
    let add = '_';

    editor.replaceSelection(add + editor.getSelection() + add);

    selectionStart.ch += add.length;
    selectionEnd.ch += add.length;
    editor.setSelection(selectionStart, selectionEnd);
  };
});
