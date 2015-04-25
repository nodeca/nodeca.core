'use strict';

N.wire.once('init:mdedit', function () {
  N.MDEdit.commands.cmdUl = function (editor) {
    var range = editor.getSelectionRange();
    var document = editor.getSession().getDocument();
    var selectedText = editor.getSession().getTextRange(range);
    var lineStartRegexp = /^ *- /;

    if (range.end.column === range.start.column && range.end.row === range.start.row) {
      if (!lineStartRegexp.test(document.getLine(range.start.row))) {
        document.insert({ column: 0, row: range.start.row }, '- ');
      }
    } else {
      document.replace(range, selectedText.split('\n').map(function (line) {
        if (lineStartRegexp.test(line)) {
          return line;
        }

        return '- ' + line;
      }).join('\n'));
    }
  };
});
