'use strict';

N.wire.once('init:mdedit', function () {
  N.MDEdit.commands.cmdItalic = function (editor) {
    // TODO: copypaste from cmd_bold
    var range = editor.getSelectionRange();
    var document = editor.getSession().getDocument();
    var selection = editor.getSelection();
    var add = '_';

    if (range.end.column === range.start.column && range.end.row === range.start.row) {
      return;
    }

    document.insert(range.end, add);
    document.insert(range.start, add);

    selection.clearSelection();
    selection.moveCursorTo(range.start.row, range.start.column + add.length);
    selection.selectTo(range.end.row, range.end.column + add.length);
  };
});
