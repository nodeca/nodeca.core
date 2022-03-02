'use strict';

N.wire.once('init:mdedit', function () {
  N.MDEdit.commands.cmdUl = function (editor) {
    let lineStartRegexp = /^ *- /;

    if (editor.selectionStart !== editor.selectionEnd) {
      let pos;
      let selectionStart = editor.selectionStart;
      pos = editor.value.lastIndexOf('\n', selectionStart - 1);
      selectionStart = pos === -1 ? 0 : pos + 1;

      let selectionEnd = editor.selectionEnd;
      pos = editor.value.indexOf('\n', selectionEnd);
      selectionEnd = pos === -1 ? editor.value.length : pos;

      let selectedText = editor.value.slice(selectionStart, selectionEnd);

      editor.setRangeText(selectedText.split('\n').map(function (line) {
        if (lineStartRegexp.test(line)) return line;

        return '- ' + line;
      }).join('\n'), selectionStart, selectionEnd);
      editor.dispatchEvent(new Event('change'));

    } else {
      let lineStart = editor.value.lastIndexOf('\n', editor.selectionStart - 1) + 1;
      let lineEnd = editor.value.indexOf('\n', lineStart);
      if (lineEnd === -1) lineEnd = editor.value.length;

      if (!lineStartRegexp.test(editor.value.slice(lineStart, lineEnd))) {
        editor.setRangeText('- ', lineStart, lineStart);
        editor.dispatchEvent(new Event('change'));
      }
    }
  };
});
