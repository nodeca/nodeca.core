'use strict';

N.wire.once('init:mdedit', function () {
  N.MDEdit.commands.cmdOl = function (editor) {
    let lineStartRegexp = /^ *[0-9]+\. /;

    if (editor.selectionStart !== editor.selectionEnd) {
      let pos;
      let selectionStart = editor.selectionStart;
      pos = editor.value.lastIndexOf('\n', selectionStart - 1);
      selectionStart = pos === -1 ? 0 : pos + 1;

      let selectionEnd = editor.selectionEnd;
      pos = editor.value.indexOf('\n', selectionEnd);
      selectionEnd = pos === -1 ? editor.value.length : pos;

      let selectedText = editor.value.slice(selectionStart, selectionEnd);
      let i = 1;

      editor.setRangeText(selectedText.split('\n').map(function (line) {
        if (lineStartRegexp.test(line)) return line;

        return i++ + '. ' + line;
      }).join('\n'), selectionStart, selectionEnd);
      editor.dispatchEvent(new Event('change'));

    } else {
      let lineStart = editor.value.lastIndexOf('\n', editor.selectionStart - 1) + 1;
      let lineEnd = editor.value.indexOf('\n', lineStart);
      if (lineEnd === -1) lineEnd = editor.value.length;

      if (!lineStartRegexp.test(editor.value.slice(lineStart, lineEnd))) {
        editor.setRangeText('1. ', lineStart, lineStart);
        editor.dispatchEvent(new Event('change'));
      }
    }
  };
});
