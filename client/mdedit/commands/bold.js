'use strict';

N.wire.once('init:mdedit', function () {
  N.MDEdit.prototype.commands.cmdBold = function (editor) {
    var range = editor.getSelectionRange();
    var document = editor.getSession().getDocument();
    var selection = editor.getSelection();
    var add = '__';

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
