'use strict';

N.wire.once('init:mdedit', function () {
  N.MDEdit.commands.cmdBold = function (editor) {
    if (!editor.somethingSelected()) {
      return;
    }

    var selectionStart = editor.getCursor(true);
    var selectionEnd = editor.getCursor(false);
    var add = '__';

    editor.replaceSelection(add + editor.getSelection() + add);

    selectionStart.ch += add.length;
    selectionEnd.ch += add.length;
    editor.setSelection(selectionStart, selectionEnd);
  };
});
