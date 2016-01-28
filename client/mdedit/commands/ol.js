'use strict';

N.wire.once('init:mdedit', function () {
  N.MDEdit.commands.cmdOl = function (editor) {
    let selectionStart = editor.getCursor(true);
    let selectedText = editor.getSelection();
    let lineStartRegexp = /^ *[0-9]+\. /;

    if (editor.somethingSelected()) {
      let i = 1;

      editor.replaceSelection(selectedText.split('\n').map(function (line) {
        if (lineStartRegexp.test(line)) return line;

        return i++ + '. ' + line;
      }).join('\n'));

    } else if (!lineStartRegexp.test(editor.getLine(selectionStart.line))) {
      selectionStart.ch = 0;
      editor.replaceRange('1. ', selectionStart, selectionStart);
    }
  };
});
