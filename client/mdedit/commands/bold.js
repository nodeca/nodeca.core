'use strict';

N.wire.once('init:mdedit', function () {
  N.MDEdit.commands.cmdBold = function (editor) {
    if (!editor.somethingSelected()) return;

    let selectionStart = editor.getCursor(true);
    let selectionEnd = editor.getCursor(false);
    let add = '__';

    editor.replaceSelection(add + editor.getSelection() + add);

    selectionStart.ch += add.length;
    selectionEnd.ch += add.length;
    editor.setSelection(selectionStart, selectionEnd);
  };
});
