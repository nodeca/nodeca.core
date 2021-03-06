'use strict';

N.wire.once('init:mdedit', function () {
  N.MDEdit.commands.cmdUl = function (editor) {
    let selectionStart = editor.getCursor(true);
    let selectedText = editor.getSelection();
    let lineStartRegexp = /^ *- /;

    if (editor.somethingSelected()) {
      editor.replaceSelection(selectedText.split('\n').map(function (line) {
        if (lineStartRegexp.test(line)) return line;

        return '- ' + line;
      }).join('\n'));

    } else if (!lineStartRegexp.test(editor.getLine(selectionStart.line))) {
      selectionStart.ch = 0;
      editor.replaceRange('- ', selectionStart, selectionStart);
    }
  };
});
