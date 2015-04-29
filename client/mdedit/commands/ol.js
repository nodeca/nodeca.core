'use strict';

N.wire.once('init:mdedit', function () {
  N.MDEdit.commands.cmdOl = function (editor) {
    var selectionStart = editor.getCursor(true);
    var selectedText = editor.getSelection();
    var lineStartRegexp = /^ *[0-9]+\. /;

    if (editor.somethingSelected()) {
      var i = 1;

      editor.replaceSelection(selectedText.split('\n').map(function (line) {
        if (lineStartRegexp.test(line)) {
          return line;
        }

        return i++ + '. ' + line;
      }).join('\n'));

    } else if (!lineStartRegexp.test(editor.getLine(selectionStart.line))) {
      selectionStart.ch = 0;
      editor.replaceRange('1. ', selectionStart, selectionStart);
    }
  };
});
