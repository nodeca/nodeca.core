'use strict';


const text_field_update = require('../_lib/text_field_update');


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

      editor.selectionStart = selectionStart;
      editor.selectionEnd   = selectionEnd;

      text_field_update.insert(editor, selectedText.split('\n').map(function (line) {
        if (lineStartRegexp.test(line)) return line;

        return i++ + '. ' + line;
      }).join('\n'));

    } else {
      let lineStart = editor.value.lastIndexOf('\n', editor.selectionStart - 1) + 1;
      let lineEnd = editor.value.indexOf('\n', lineStart);
      if (lineEnd === -1) lineEnd = editor.value.length;

      if (!lineStartRegexp.test(editor.value.slice(lineStart, lineEnd))) {
        editor.selectionStart = lineStart;
        editor.selectionEnd   = lineEnd;

        text_field_update.insert(editor, '1. ' + editor.value.slice(lineStart, lineEnd));
      }
    }
  };
});
