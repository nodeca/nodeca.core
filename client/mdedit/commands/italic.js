'use strict';

N.wire.once('init:mdedit', function () {
  N.MDEdit.commands.cmdItalic = function (editor) {
    // TODO: copypaste from cmd_bold
    if (!editor.somethingSelected()) {
      return;
    }

    var selectionStart = editor.getCursor(true);
    var selectionEnd = editor.getCursor(false);
    var add = '_';

    editor.replaceSelection(add + editor.getSelection() + add);

    selectionStart.ch += add.length;
    selectionEnd.ch += add.length;
    editor.setSelection(selectionStart, selectionEnd);
  };
});
